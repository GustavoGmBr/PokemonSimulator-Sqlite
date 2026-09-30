export function requireSaveContext(db) {
  return async (req, res, next) => {
    const saveId = req.get('X-Save-Id');
    if (!saveId) return res.status(409).json({ success: false, error: 'Selecione um save para continuar.' });
    try {
      const save = await db.save.findUnique({ where: { id: saveId }, select: { usuarioId: true } });
      if (!save) return res.status(404).json({ success: false, error: 'Save não encontrado.' });
      req.usuarioId = save.usuarioId;
      next();
    } catch (error) {
      next(error);
    }
  };
}
