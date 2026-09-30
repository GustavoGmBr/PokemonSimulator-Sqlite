using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

internal static class UpdateService
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 };

    internal static bool Check(string root, Action<string> report, Func<bool> cancelled)
    {
        try
        {
            string configPath = Path.Combine(root, "release-config.json");
            if (!File.Exists(configPath)) return false;
            Dictionary<string, object> config = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(configPath));
            Dictionary<string, object> package = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(root, "package.json")));
            string repository = (string)config["repository"];
            if (!Regex.IsMatch(repository, @"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")) throw new InvalidDataException("Repositório de atualização inválido.");
            Version installed = Version.Parse((string)package["version"]);
            report("Verificando atualizações…");
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            Dictionary<string, object> release = Json.Deserialize<Dictionary<string, object>>(ReadText("https://api.github.com/repos/" + repository + "/releases/latest"));
            string tag = (string)release["tag_name"];
            Version latest;
            if ((bool)release["draft"] || (bool)release["prerelease"] || !Regex.IsMatch(tag, @"^v\d+\.\d+\.\d+$") || !Version.TryParse(tag.Substring(1), out latest) || latest <= installed)
            {
                report("A versão instalada está atualizada. Iniciando o jogo…");
                return false;
            }
            string name = (string)config["assetPrefix"] + "-" + tag + "-update-win-x64.zip";
            string archiveUrl = null;
            string checksumUrl = null;
            foreach (object value in (System.Collections.IEnumerable)release["assets"])
            {
                Dictionary<string, object> asset = (Dictionary<string, object>)value;
                if ((string)asset["name"] == name) archiveUrl = (string)asset["browser_download_url"];
                if ((string)asset["name"] == name + ".sha256") checksumUrl = (string)asset["browser_download_url"];
            }
            if (archiveUrl == null || checksumUrl == null) throw new InvalidDataException("A versão publicada ainda não contém o pacote completo de atualização.");
            string expectedPrefix = "https://github.com/" + repository + "/releases/download/" + tag + "/";
            if (!archiveUrl.StartsWith(expectedPrefix, StringComparison.Ordinal) || !checksumUrl.StartsWith(expectedPrefix, StringComparison.Ordinal)) throw new InvalidDataException("Endereço de atualização inválido.");
            string checksum = ReadText(checksumUrl).Trim().Split(' ', '\t', '\r', '\n')[0].ToLowerInvariant();
            if (!Regex.IsMatch(checksum, @"^[a-f0-9]{64}$")) throw new InvalidDataException("Checksum inválido.");
            if (cancelled()) return false;
            string temporary = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PokemonSimulator", "updates", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temporary);
            string archive = Path.Combine(temporary, name);
            Download(archiveUrl, archive, report, tag, cancelled);
            string actual;
            using (SHA256 hash = SHA256.Create())
            using (FileStream stream = File.OpenRead(archive)) actual = BitConverter.ToString(hash.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
            if (actual != checksum) throw new InvalidDataException("O download não passou na verificação de integridade. A versão instalada será mantida.");
            if (cancelled()) return false;
            string helper = Path.Combine(temporary, "PokemonSimulatorUpdater.exe");
            File.Copy(Path.Combine(root, "PokemonSimulatorUpdater.exe"), helper);
            report("Aplicando " + tag + ". Seus saves serão preservados…");
            ProcessStartInfo start = new ProcessStartInfo(helper);
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.Arguments = "--apply " + Quote(root) + " " + Quote(archive) + " " + checksum + " " + latest + " " + Process.GetCurrentProcess().Id;
            Process.Start(start);
            return true;
        }
        catch (Exception error)
        {
            report("Atualização indisponível: " + error.Message + " Iniciando a versão instalada.");
            return false;
        }
    }

    private static string Quote(string value) { return "\"" + value + "\""; }

    private static HttpWebRequest Request(string url, int timeout)
    {
        HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
        request.UserAgent = "PokemonSimulator-Updater";
        request.Accept = "application/vnd.github+json";
        request.Timeout = timeout;
        request.ReadWriteTimeout = timeout;
        request.AutomaticDecompression = DecompressionMethods.GZip;
        return request;
    }

    private static string ReadText(string url)
    {
        using (WebResponse response = Request(url, 4000).GetResponse())
        using (StreamReader reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
        {
            if (response.ContentLength > 4 * 1024 * 1024) throw new InvalidDataException("Resposta de atualização grande demais.");
            return reader.ReadToEnd();
        }
    }

    private static void Download(string url, string destination, Action<string> report, string version, Func<bool> cancelled)
    {
        HttpWebRequest request = Request(url, 30000);
        using (WebResponse response = request.GetResponse())
        using (Stream source = response.GetResponseStream())
        using (FileStream output = File.Create(destination))
        {
            long total = response.ContentLength;
            long received = 0;
            byte[] buffer = new byte[65536];
            DateTime deadline = DateTime.UtcNow.AddMinutes(10);
            DateTime reported = DateTime.MinValue;
            int count;
            while ((count = source.Read(buffer, 0, buffer.Length)) > 0)
            {
                if (cancelled()) throw new OperationCanceledException();
                if (DateTime.UtcNow > deadline || received > 2L * 1024 * 1024 * 1024) throw new IOException("O download excedeu o limite permitido.");
                output.Write(buffer, 0, count);
                received += count;
                if ((DateTime.UtcNow - reported).TotalSeconds >= 1)
                {
                    report("Baixando " + version + "… " + (total > 0 ? (received * 100 / total) + "%" : (received / 1024 / 1024) + " MB"));
                    reported = DateTime.UtcNow;
                }
            }
            if (total >= 0 && received != total) throw new IOException("Download incompleto.");
        }
    }
}
