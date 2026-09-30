using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        bool checkOnly = Array.IndexOf(args, "--check") >= 0;
        bool noBrowser = Array.IndexOf(args, "--no-browser") >= 0 || Environment.GetEnvironmentVariable("POKEMON_SIMULATOR_NO_BROWSER") == "1";
        bool skipUpdate = Array.IndexOf(args, "--skip-update") >= 0 || Environment.GetEnvironmentVariable("POKEMON_SIMULATOR_SKIP_UPDATE") == "1";
        string identity;
        using (System.Security.Cryptography.SHA256 hash = System.Security.Cryptography.SHA256.Create())
            identity = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(AppDomain.CurrentDomain.BaseDirectory.ToLowerInvariant()))).Replace("-", "");
        using (System.Threading.Mutex mutex = new System.Threading.Mutex(false, "Local\\PokemonSimulator-" + identity))
        {
            bool acquired;
            try { acquired = mutex.WaitOne(0); }
            catch (System.Threading.AbandonedMutexException) { acquired = true; }
            if (!acquired)
            {
                if (!checkOnly) MessageBox.Show("O inicializador deste jogo já está aberto.", "Pokémon Simulator");
                Environment.ExitCode = 1;
                return;
            }
            try { Application.Run(new LauncherForm(noBrowser || checkOnly, checkOnly, skipUpdate)); }
            finally { mutex.ReleaseMutex(); }
        }
    }
}

internal sealed class LauncherForm : Form
{
    private string gameUrl;
    private string logPath;
    private readonly bool noBrowser;
    private readonly bool checkOnly;
    private readonly bool skipUpdate;
    private readonly Label status = new Label();
    private readonly RichTextBox log = new RichTextBox();
    private readonly Button open = new Button();
    private readonly Button stop = new Button();
    private Process process;
    private bool allowClose;
    private bool stoppingGame;
    private readonly Timer shutdownTimer = new Timer();

    public LauncherForm(bool noBrowser, bool checkOnly, bool skipUpdate)
    {
        this.noBrowser = noBrowser;
        this.checkOnly = checkOnly;
        this.skipUpdate = skipUpdate;
        if (checkOnly) { Opacity = 0; ShowInTaskbar = false; }
        Text = "Pokémon Simulator";
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(660, 430);
        MinimumSize = new Size(560, 360);
        BackColor = Color.FromArgb(20, 29, 24);
        ForeColor = Color.FromArgb(232, 239, 224);
        Font = new Font("Segoe UI", 10F);

        Label heading = new Label();
        heading.Text = "POKÉMON SIMULATOR";
        heading.Font = new Font("Segoe UI Semibold", 17F);
        heading.ForeColor = Color.FromArgb(194, 215, 153);
        heading.AutoSize = true;
        heading.Location = new Point(24, 20);

        status.Text = "Preparando o jogo…";
        status.AutoSize = true;
        status.Location = new Point(27, 61);
        status.ForeColor = Color.FromArgb(185, 198, 174);

        log.ReadOnly = true;
        log.BorderStyle = BorderStyle.FixedSingle;
        log.BackColor = Color.FromArgb(13, 19, 16);
        log.ForeColor = Color.FromArgb(207, 218, 197);
        log.Font = new Font("Consolas", 9F);
        log.Location = new Point(24, 92);
        log.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        log.Size = new Size(612, 270);

        open.Text = "Abrir jogo";
        open.Enabled = false;
        open.Location = new Point(24, 378);
        open.Size = new Size(125, 32);
        open.Anchor = AnchorStyles.Bottom | AnchorStyles.Left;
        open.Click += delegate { OpenGame(); };

        stop.Text = "Encerrar jogo";
        stop.Location = new Point(511, 378);
        stop.Size = new Size(125, 32);
        stop.Anchor = AnchorStyles.Bottom | AnchorStyles.Right;
        stop.Click += delegate { StopGame(); };

        Controls.AddRange(new Control[] { heading, status, log, open, stop });
        Shown += delegate { StartGame(); };
        FormClosing += OnFormClosing;
        shutdownTimer.Interval = 5000;
        shutdownTimer.Tick += delegate
        {
            shutdownTimer.Stop();
            if (process == null || process.HasExited) return;
            AppendLog("Encerrando os processos do inicializador.");
            ProcessStartInfo killInfo = new ProcessStartInfo("taskkill.exe", "/pid " + process.Id + " /t /f");
            killInfo.UseShellExecute = false;
            killInfo.CreateNoWindow = true;
            try { Process.Start(killInfo); } catch (Exception error) { AppendLog(error.Message); }
        };
    }

    private void StartGame()
    {
        string root = FindProjectRoot(AppDomain.CurrentDomain.BaseDirectory);
        if (root == null) { StartRuntime(); return; }
        try
        {
            logPath = Path.Combine(root, "launcher", "latest.log");
            Directory.CreateDirectory(Path.GetDirectoryName(logPath));
            File.WriteAllText(logPath, "Inicialização: " + DateTime.Now.ToString("s") + Environment.NewLine, Encoding.UTF8);
        }
        catch (Exception error) { AppendLog("Não foi possível gravar o log: " + error.Message); }
        if (skipUpdate || checkOnly) { StartRuntime(); return; }
        System.Threading.ThreadPool.QueueUserWorkItem(delegate
        {
            bool handingOver = UpdateService.Check(root, delegate(string message) { SetStatus(message); AppendLog(message); }, delegate { return IsDisposed || !IsHandleCreated; });
            if (IsDisposed || !IsHandleCreated) return;
            try
            {
                BeginInvoke((Action)delegate
                {
                    if (handingOver) { allowClose = true; Close(); }
                    else StartRuntime();
                });
            }
            catch (InvalidOperationException) { }
        });
    }

    private void StartRuntime()
    {
        try
        {
            string root = FindProjectRoot(AppDomain.CurrentDomain.BaseDirectory);
            if (root == null)
            {
                SetStatus("Não encontrei os arquivos do jogo ao lado do executável.");
                AppendLog("Mantenha PokemonSimulator.exe na pasta principal do projeto, junto de backend, frontend e scripts.");
                stop.Text = "Fechar";
                if (checkOnly) { Environment.ExitCode = 1; Close(); }
                return;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo(FindNode());
            startInfo.WorkingDirectory = root;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.RedirectStandardInput = true;
            startInfo.RedirectStandardOutput = true;
            startInfo.RedirectStandardError = true;
            startInfo.StandardOutputEncoding = Encoding.UTF8;
            startInfo.StandardErrorEncoding = Encoding.UTF8;
            startInfo.Arguments = "\"" + Path.Combine(root, "scripts", "start-game.js") + "\" --no-browser";
            startInfo.EnvironmentVariables["POKEMON_SIMULATOR_GUI"] = "1";

            process = new Process();
            process.StartInfo = startInfo;
            process.EnableRaisingEvents = true;
            process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) OnOutput(e.Data); };
            process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) OnOutput(e.Data); };
            process.Exited += delegate { OnProcessExited(); };
            if (!process.Start()) throw new InvalidOperationException("O inicializador não pôde ser iniciado.");
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            SetStatus("Iniciando o jogo em segundo plano…");
            AppendLog("Aguarde enquanto a API local e a interface iniciam.");
        }
        catch (Exception error)
        {
            SetStatus("Não foi possível iniciar o jogo.");
            AppendLog(error.Message);
            stop.Text = "Fechar";
            if (checkOnly) { Environment.ExitCode = 1; Close(); }
        }
    }

    private static string FindNode()
    {
        string bundled = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "runtime", "node.exe");
        if (File.Exists(bundled)) return bundled;
        foreach (string directory in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            try
            {
                string candidate = Path.Combine(directory.Trim().Trim('"'), "node.exe");
                if (File.Exists(candidate)) return candidate;
            }
            catch (ArgumentException) { }
        }
        foreach (string directory in new string[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) })
        {
            string candidate = Path.Combine(directory, "nodejs", "node.exe");
            if (File.Exists(candidate)) return candidate;
        }
        throw new FileNotFoundException("Node.js não foi encontrado. Instale Node.js 22.12 ou superior.");
    }

    private void OpenGame()
    {
        if (gameUrl == null) return;
        try { Process.Start(new ProcessStartInfo(gameUrl) { UseShellExecute = true }); }
        catch (Exception error)
        {
            SetStatus("Não foi possível abrir o navegador automaticamente.");
            AppendLog(error.Message + Environment.NewLine + "Abra este endereço no navegador: " + gameUrl);
        }
    }

    private static string FindProjectRoot(string start)
    {
        DirectoryInfo directory = new DirectoryInfo(start);
        while (directory != null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "scripts", "start-game.js")) &&
                Directory.Exists(Path.Combine(directory.FullName, "backend")) &&
                Directory.Exists(Path.Combine(directory.FullName, "frontend")))
                return directory.FullName;
            directory = directory.Parent;
        }
        return null;
    }

    private void OnOutput(string line)
    {
        if (line.StartsWith("Baixando sprites:") || line.StartsWith("Instalando sprites:") || line.StartsWith("Primeiro início:") || line.StartsWith("Verificando sprites locais")) SetStatus(line);
        const string readyPrefix = "Jogo pronto:";
        int readyIndex = line.IndexOf(readyPrefix, StringComparison.OrdinalIgnoreCase);
        if (readyIndex >= 0)
        {
            string readyUrl = line.Substring(readyIndex + readyPrefix.Length).Trim();
            Uri uri;
            if (Uri.TryCreate(readyUrl, UriKind.Absolute, out uri) && uri.Scheme == "http" && uri.IsLoopback && !IsDisposed && IsHandleCreated)
                BeginInvoke((Action)delegate
                {
                    if (stoppingGame) return;
                    gameUrl = readyUrl;
                    SetStatus("Jogo pronto. Esta janela pode ficar aberta enquanto você joga.");
                    open.Enabled = true;
                    if (checkOnly)
                    {
                        AppendLog("Verificação concluída: " + gameUrl);
                        allowClose = true;
                        StopGame();
                    }
                    else if (!noBrowser) OpenGame();
                });
        }
        else if (line.IndexOf("Não foi possível iniciar:", StringComparison.OrdinalIgnoreCase) >= 0)
            SetStatus("A inicialização falhou. Veja os detalhes abaixo.");
        AppendLog(line);
    }

    private void OnProcessExited()
    {
        if (IsDisposed || !IsHandleCreated) return;
        BeginInvoke((Action)delegate
        {
            shutdownTimer.Stop();
            int code = process == null ? 0 : process.ExitCode;
            if (checkOnly) Environment.ExitCode = code;
            SetStatus(code == 0 ? "Jogo encerrado." : "O jogo foi encerrado com erro. Veja os detalhes acima.");
            stop.Text = "Fechar";
            stop.Enabled = true;
            open.Enabled = false;
            AppendLog("Inicializador encerrado (código " + code + ").");
            if (allowClose || checkOnly) Close();
        });
    }

    private void StopGame()
    {
        if (process == null || process.HasExited)
        {
            allowClose = true;
            Close();
            return;
        }
        if (stoppingGame) return;
        stoppingGame = true;
        SetStatus("Encerrando o jogo…");
        stop.Enabled = false;
        open.Enabled = false;
        shutdownTimer.Start();
        try
        {
            process.StandardInput.WriteLine("stop");
            process.StandardInput.Flush();
        }
        catch (IOException error) { AppendLog(error.Message); }
        catch (InvalidOperationException error) { AppendLog(error.Message); }
    }

    private void OnFormClosing(object sender, FormClosingEventArgs e)
    {
        if (process == null || process.HasExited) return;
        e.Cancel = true;
        allowClose = true;
        StopGame();
    }

    private void SetStatus(string text)
    {
        if (IsDisposed || !IsHandleCreated) return;
        if (InvokeRequired) { BeginInvoke((Action)delegate { SetStatus(text); }); return; }
        status.Text = text;
    }

    private void AppendLog(string text)
    {
        if (IsDisposed || !IsHandleCreated) return;
        if (InvokeRequired) { BeginInvoke((Action)delegate { AppendLog(text); }); return; }
        if (logPath != null)
        {
            try { File.AppendAllText(logPath, text + Environment.NewLine, Encoding.UTF8); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
        log.AppendText(text + Environment.NewLine);
        log.SelectionStart = log.TextLength;
        log.ScrollToCaret();
    }
}
