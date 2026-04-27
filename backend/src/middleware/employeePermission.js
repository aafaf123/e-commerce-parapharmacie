import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Extract module name from request path
 * @param {string} path - Request path (e.g., /admin/products, /admin/orders/123)
 * @returns {string|null} - Module key or null
 */
function extractModuleFromPath(path) {
  // Remove query string
  const cleanPath = path.split('?')[0];
  const segments = cleanPath.split('/').filter(Boolean); // Remove empty segments

  if (segments.length < 2) return null;

  // Skip 'admin' segment (segments[0]) and look at next segment
  // /admin/products -> module = 'products'
  // /admin/orders -> module = 'orders'
  // /admin/promotions -> module = 'promotions'
  // /admin/time-slots/config -> module = 'timeslots' (normalize)
  // /admin/suppliers -> module = 'suppliers'
  // /admin/categories -> module = 'categories'
  // /admin/users -> module = 'customers' (or 'users' mapped to customers)
  // /admin/reports -> module = 'reports'

  const secondSegment = segments[1];

  // Mapping de normalisation
  const moduleMap = {
    'products': 'products',
    'orders': 'orders',
    'order': 'orders', // singular variant
    'reports': 'reports',
    'report': 'reports',
    'promotions': 'promotions',
    'promotion': 'promotions',
    'promo-codes': 'promotions', // promo-codes managed under promotions module
    'promoCodes': 'promotions',
    'time-slots': 'timeslots',
    'timeslots': 'timeslots',
    'slots': 'timeslots',
    'suppliers': 'suppliers',
    'supplier': 'suppliers',
    'purchases': 'suppliers', // purchase orders under suppliers
    'purchase-orders': 'suppliers',
    'categories': 'categories',
    'category': 'categories',
    'subcategories': 'categories',
    'brands': 'categories', // brands managed as category-related
    'users': 'customers', // users (clients) - customers module
    'customers': 'customers',
    'clients': 'customers',
    'staff': 'employees', // staff/employees management
    'employees': 'employees',
    'team': 'employees'
  };

  return moduleMap[secondSegment] || null;
}

/**
 * Get HTTP method action for permission check
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH)
 * @returns {string} - Action key ('view', 'create', 'edit', 'delete')
 */
function getActionFromMethod(method) {
  switch (method) {
    case 'GET':
      return 'view';
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'edit';
    case 'DELETE':
      return 'delete';
    default:
      return 'view';
  }
}

/**
 * Middleware: Vérifie les permissions d'un employé pour un module
 * Doit être placé APRès authenticateToken et après verification que l'user est EMPLOYE
 *
 * Usage:
 *   router.get('/admin/products', checkEmployeePermission('products', 'view'), handler)
 *   OU
 *   router.get('/admin/products', autoCheckEmployeePermission, handler) // auto-detects from path
 */
export const checkEmployeePermission = (module, action = 'view') => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Non authentifié' });
      }

      // Récupérer les permissions de l'utilisateur pour ce module
      const permission = await prisma.employeePermission.findUnique({
        where: {
          userId_module: { userId, module }
        }
      });

      // Si pas de permission, refuser l'accès
      if (!permission) {
        return res.status(403).json({
          message: `Accès refusé. Permissions requises pour le module "${module}"`
        });
      }

      // Vérifier l'action spécifique
      const actionMap = {
        view: 'canView',
        create: 'canCreate',
        edit: 'canEdit',
        delete: 'canDelete'
      };
      const permissionKey = actionMap[action];

      if (permission[permissionKey] !== true) {
        return res.status(403).json({
          message: `Accès refusé. Droits "${action}" requis pour le module "${module}"`
        });
      }

      // Attacher les permissions à req.employeePermissions pour utilisation dans les handlers
      req.employeePermissions = req.employeePermissions || {};
      req.employeePermissions[module] = permission;

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Erreur vérification permissions' });
    }
  };
};

/**
 * Middleware générique: détection automatique du module depuis le chemin
 * À appliquer aux routes admin des employés (ils passent par ce middleware)
 * Exemple: router.use('/admin/...', autoEmployeePermissionCheck)
 */
export const autoCheckEmployeePermission = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    // Ne pas appliquer aux routes de permissions elles-mêmes
    if (req.path.includes('/permissions')) {
      return next();
    }

    // Si l'utilisateur est ADMIN, passer automatiquement
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }

    if (user.role === 'ADMIN') {
      return next();
    }

    // Pour les employés, vérifier les permissions automatiquement
    const module = extractModuleFromPath(req.path);
    if (!module) {
      // Si on ne peut pas déterminer le module, laisser passer (route non protégée)
      return next();
    }

    const action = getActionFromMethod(req.method);

    const permission = await prisma.employeePermission.findUnique({
      where: {
        userId_module: { userId, module }
      }
    });

    if (!permission) {
      return res.status(403).json({
        message: `Accès refusé. Aucune permission pour le module "${module}"`
      });
    }

    const actionMap = {
      view: 'canView',
      create: 'canCreate',
      edit: 'canEdit',
      delete: 'canDelete'
    };
    const permissionKey = actionMap[action];

    if (permission[permissionKey] !== true) {
      return res.status(403).json({
        message: `Accès refusé. Droits "${action}" requis pour le module "${module}"`
      });
    }

    // Attacher pour usage dans les handlers
    req.employeePermissions = req.employeePermissions || {};
    req.employeePermissions[module] = permission;

    next();
  } catch (error) {
    console.error('Auto permission check error:', error);
    res.status(500).json({ message: 'Erreur vérification permissions' });
  }
};

/**
 * Middleware pour récupérer toutes les permissions de l'employé courant
 * Peut être utilisé pour attacher toutes les permissions à req.allPermissions
 */
export const attachEmployeePermissions = async (req, res, next) => {
  try {
    if (!req.userId) {
      return next();
    }

    const permissions = await prisma.employeePermission.findMany({
      where: { userId: req.userId }
    });

    req.allPermissions = {};
    permissions.forEach(p => {
      req.allPermissions[p.module] = {
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete
      };
    });

    next();
  } catch (error) {
    console.error('Attach permissions error:', error);
    next(); // Ne pas bloquer si erreur
  }
};
