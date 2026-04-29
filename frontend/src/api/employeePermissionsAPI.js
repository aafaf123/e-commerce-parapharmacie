// Exemple d'utilisation des API pour gérer les employés et leurs permissions

// 1. Créer un employé avec permissions personnalisées
const createEmployeeWithPermissions = async () => {
  const employeeData = {
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@parapharmacie.ma',
    password: 'motdepasse123',
    phone: '0612345678',
    salary: 2500,
    permissions: {
      // Permissions pour les produits
      products: {
        canView: true,     // Peut consulter les produits
        canCreate: true,   // Peut créer des produits
        canEdit: true,     // Peut modifier les produits
        canDelete: false   // Ne peut pas supprimer les produits
      },
      // Permissions pour les commandes
      orders: {
        canView: true,     // Peut consulter les commandes
        canCreate: false,  // Ne peut pas créer de commandes
        canEdit: true,     // Peut modifier le statut des commandes
        canDelete: false   // Ne peut pas supprimer les commandes
      },
      // Permissions pour les rapports
      reports: {
        canView: true,     // Peut consulter les rapports
        canCreate: false,  // Ne peut pas créer de rapports
        canEdit: false,    // Ne peut pas modifier les rapports
        canDelete: false   // Ne peut pas supprimer les rapports
      },
      // Permissions pour les promotions
      promotions: {
        canView: false,    // Ne peut pas consulter les promotions
        canCreate: false,  // Ne peut pas créer de promotions
        canEdit: false,    // Ne peut pas modifier les promotions
        canDelete: false   // Ne peut pas supprimer les promotions
      },
      // Permissions pour les créneaux horaires
      timeslots: {
        canView: true,     // Peut consulter les créneaux
        canCreate: false,  // Ne peut pas créer de créneaux
        canEdit: false,    // Ne peut pas modifier les créneaux
        canDelete: false   // Ne peut pas supprimer les créneaux
      },
      // Permissions pour les fournisseurs
      suppliers: {
        canView: false,    // Ne peut pas consulter les fournisseurs
        canCreate: false,  // Ne peut pas créer de fournisseurs
        canEdit: false,    // Ne peut pas modifier les fournisseurs
        canDelete: false   // Ne peut pas supprimer les fournisseurs
      },
      // Permissions pour les catégories
      categories: {
        canView: true,     // Peut consulter les catégories
        canCreate: false,  // Ne peut pas créer de catégories
        canEdit: false,    // Ne peut pas modifier les catégories
        canDelete: false   // Ne peut pas supprimer les catégories
      },
      // Permissions pour les clients
      customers: {
        canView: true,     // Peut consulter les clients
        canCreate: false,  // Ne peut pas créer de clients
        canEdit: false,    // Ne peut pas modifier les clients
        canDelete: false   // Ne peut pas supprimer les clients
      },
      // Permissions pour l'inventaire
      inventory: {
        canView: true,     // Peut consulter l'inventaire
        canCreate: false,  // Ne peut pas créer d'entrées d'inventaire
        canEdit: true,     // Peut modifier l'inventaire
        canDelete: false   // Ne peut pas supprimer d'entrées d'inventaire
      },
      // Permissions pour les paramètres
      settings: {
        canView: false,    // Ne peut pas consulter les paramètres
        canCreate: false,  // Ne peut pas créer de paramètres
        canEdit: false,    // Ne peut pas modifier les paramètres
        canDelete: false   // Ne peut pas supprimer les paramètres
      },
      // Permissions pour les employés
      employees: {
        canView: false,    // Ne peut pas consulter les autres employés
        canCreate: false,  // Ne peut pas créer d'employés
        canEdit: false,    // Ne peut pas modifier les employés
        canDelete: false   // Ne peut pas supprimer les employés
      }
    }
  };

  try {
    const response = await fetch('/api/admin/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(employeeData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('Employé créé avec succès:', result);
      return result;
    } else {
      console.error('Erreur:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erreur lors de la création:', error);
    throw error;
  }
};

// 2. Récupérer les permissions d'un employé
const getEmployeePermissions = async (employeeId) => {
  try {
    const response = await fetch(`/api/admin/employees/${employeeId}/permissions`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('Permissions de l\'employé:', result);
      return result;
    } else {
      console.error('Erreur:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    throw error;
  }
};

// 3. Modifier les permissions d'un employé
const updateEmployeePermissions = async (employeeId, newPermissions) => {
  try {
    const response = await fetch(`/api/admin/employees/${employeeId}/permissions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ permissions: newPermissions })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('Permissions mises à jour:', result);
      return result;
    } else {
      console.error('Erreur:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    throw error;
  }
};

// 4. Récupérer la liste des modules disponibles
const getAvailableModules = async () => {
  try {
    const response = await fetch('/api/admin/employees/permissions/modules', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('Modules disponibles:', result);
      return result;
    } else {
      console.error('Erreur:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    throw error;
  }
};

// 5. Exemple d'utilisation complète
const exempleUtilisation = async () => {
  try {
    console.log('=== Exemple d\'utilisation des API employés ===');
    
    // 1. Récupérer les modules disponibles
    console.log('\n1. Récupération des modules...');
    const modules = await getAvailableModules();
    
    // 2. Créer un employé avec permissions
    console.log('\n2. Création d\'un employé...');
    const newEmployee = await createEmployeeWithPermissions();
    const employeeId = newEmployee.employee.id;
    
    // 3. Récupérer les permissions de l'employé créé
    console.log('\n3. Récupération des permissions...');
    const permissions = await getEmployeePermissions(employeeId);
    
    // 4. Modifier les permissions (donner accès aux promotions)
    console.log('\n4. Modification des permissions...');
    const updatedPermissions = {
      ...permissions.permissions,
      promotions: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false
      }
    };
    
    const result = await updateEmployeePermissions(employeeId, updatedPermissions);
    
    console.log('\n=== Exemple terminé avec succès ===');
    return result;
    
  } catch (error) {
    console.error('Erreur dans l\'exemple:', error);
  }
};

// Export des fonctions pour utilisation
export {
  createEmployeeWithPermissions,
  getEmployeePermissions,
  updateEmployeePermissions,
  getAvailableModules,
  exempleUtilisation
};

// Exemple d'utilisation dans une interface utilisateur
const ExempleInterface = () => {
  const handleCreateEmployee = async (formData) => {
    try {
      const result = await createEmployeeWithPermissions();
      alert('Employé créé avec succès !');
      // Rediriger ou rafraîchir la liste
    } catch (error) {
      alert('Erreur lors de la création : ' + error.message);
    }
  };

  const handleEditPermissions = async (employeeId, permissions) => {
    try {
      const result = await updateEmployeePermissions(employeeId, permissions);
      alert('Permissions mises à jour !');
      // Rafraîchir l'affichage
    } catch (error) {
      alert('Erreur lors de la mise à jour : ' + error.message);
    }
  };

  return {
    handleCreateEmployee,
    handleEditPermissions
  };
};

export default ExempleInterface;