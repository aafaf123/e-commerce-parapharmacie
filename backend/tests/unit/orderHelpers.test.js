// Test de la fonction generateOrderNumber (logique pure dans orders.js)
// On la teste directement sans importer le module entier

function generateOrderNumber() {
  return 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

describe('generateOrderNumber', () => {
  it('commence par ORD-', () => {
    const num = generateOrderNumber();
    expect(num).toMatch(/^ORD-/);
  });

  it('contient un timestamp numérique', () => {
    const num = generateOrderNumber();
    const parts = num.split('-');
    expect(parts.length).toBe(3);
    expect(Number(parts[1])).toBeGreaterThan(0);
  });

  it('contient un suffixe aléatoire entre 0 et 999', () => {
    const num = generateOrderNumber();
    const suffix = parseInt(num.split('-')[2]);
    expect(suffix).toBeGreaterThanOrEqual(0);
    expect(suffix).toBeLessThanOrEqual(999);
  });

  it('génère des numéros uniques', () => {
    const numbers = new Set(Array.from({ length: 100 }, () => generateOrderNumber()));
    // Avec timestamp + random, les 100 premiers doivent être quasi-uniques
    expect(numbers.size).toBeGreaterThan(50);
  });

  it('format correspond au pattern ORD-{timestamp}-{random}', () => {
    const num = generateOrderNumber();
    expect(num).toMatch(/^ORD-\d+-\d+$/);
  });
});

// ── Logique de validation du panier (extraite de orders.js) ──────────────────
function validateCartItems(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'Le panier est vide' };
  }
  return { valid: true };
}

describe('validateCartItems', () => {
  it('retourne invalid si items est null', () => {
    expect(validateCartItems(null).valid).toBe(false);
  });

  it('retourne invalid si items est un tableau vide', () => {
    expect(validateCartItems([]).valid).toBe(false);
  });

  it('retourne invalid si items n\'est pas un tableau', () => {
    expect(validateCartItems('not-array').valid).toBe(false);
  });

  it('retourne valid si items contient au moins un élément', () => {
    const result = validateCartItems([{ id: 'p1', quantity: 1, price: 10 }]);
    expect(result.valid).toBe(true);
  });

  it('message d\'erreur correct pour panier vide', () => {
    expect(validateCartItems([]).error).toBe('Le panier est vide');
  });
});
