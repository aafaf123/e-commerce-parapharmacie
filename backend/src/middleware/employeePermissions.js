import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const checkEmployeePermission = (module, action = 'canView') => {
  return async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, role: true, isActive: true }
      });

      if (!user || !user.isActive) {
        return res.status(403).json({ message: 'Compte désactivé' });
      }

      // Les admins ont tous les droits
      if (user.role === 'ADMIN') {
        return next();
      }

      // Pour les employés, vérifier les permissions spécifiques
      if (user.role === 'EMPLOYE' || user.role === 'PREPARATEUR' || user.role === 'CAISSIER') {
        const permission = await prisma.employeePermission.findUnique({
          where: { userId_module: { userId: user.id, module } }
        });

        if (!permission || !permission[action]) {
          return res.status(403).json({ 
            message: `Accès refusé. Permission requise: ${module} - ${action}`,
            module,
            action
          });
        }

        return next();
      }

      return res.status(403).json({ message: 'Accès refusé' });
    } catch (error) {
      console.error('Employee permission check error:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  };
};