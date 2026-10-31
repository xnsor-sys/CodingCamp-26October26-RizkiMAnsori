const STORAGE_KEY = 'daybook-expenses-v1';
const CATEGORIES = {
  Food: { color: '#e8845b', icon: '◒' },
  Transport: { color: '#438d81', icon: '↗' },
  Fun: { color: '#d3a83c', icon: '✳' }
};

const form = document.querySelector('#expense-form');
const nameInput = document.querySelector('#item-name');
const amountInput = document.querySelector('#item-amount');
const categoryInput = document.querySelector('#item-category');
const formError = document.querySelector('#form-error');
const list = document.querySelector('#transaction-list');
const chart = document.querySelector('#spending-chart');

let expenses = loadExpenses();

function loadExpenses() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((expense) => (
      expense && typeof expense.id === 'string' &&
      typeof expense.name === 'string' && expense.name.trim() &&
      Number.isFinite(expense.amount) && expense.amount > 0 &&
      Object.hasOwn(CATEGORIES, expense.category) &&
      typeof expense.date === 'string'
    ));
  } catch {
    return [];
  }
}

function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    return true;
  } catch {
    formError.textContent = 'Could not save your entry. Check browser storage settings.';
    return false;
  }
}

function formatCurrency(value, compact = false) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function render() {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categoryTotals = Object.fromEntries(Object.keys(CATEGORIES).map((category) => [category, 0]));
  expenses.forEach((expense) => { categoryTotals[expense.category] += expense.amount; });

  document.querySelector('#total-balance').textContent = formatCurrency(total);
  document.querySelector('#chart-total').textContent = formatCurrency(total, true);
  document.querySelector('#transaction-count').textContent = `Across ${expenses.length} transaction${expenses.length === 1 ? '' : 's'}`;
  document.querySelector('#list-count').textContent = expenses.length;

  const nonzeroCategories = Object.entries(categoryTotals).filter(([, amount]) => amount > 0);
  let angle = 0;
  const segments = nonzeroCategories.map(([category, amount]) => {
    const start = angle;
    angle += (amount / total) * 360;
    return `${CATEGORIES[category].color} ${start}deg ${angle}deg`;
  });
  chart.style.background = segments.length ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(#e7ebe4 0deg 360deg)';
  chart.setAttribute('aria-label', nonzeroCategories.length
    ? `Spending distribution: ${nonzeroCategories.map(([category, amount]) => `${category} ${formatCurrency(amount)}`).join(', ')}`
    : 'No spending recorded yet');

  const legend = document.querySelector('#chart-legend');
  legend.replaceChildren();
  if (nonzeroCategories.length) {
    nonzeroCategories.forEach(([category, amount]) => {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.backgroundColor = CATEGORIES[category].color;
      swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = category;
      const value = document.createElement('span');
      value.className = 'legend-value';
      value.textContent = formatCurrency(amount);
      item.append(swatch, label, value);
      legend.append(item);
    });
  } else {
    const empty = document.createElement('li');
    empty.className = 'legend-empty';
    empty.textContent = 'Your category breakdown will appear here.';
    legend.append(empty);
  }

  list.querySelectorAll('.transaction-row').forEach((row) => row.remove());
  const emptyState = document.querySelector('#empty-state');
  emptyState.hidden = expenses.length > 0;

  [...expenses].reverse().forEach((expense) => {
    const row = document.createElement('article');
    row.className = 'transaction-row';

    const main = document.createElement('div');
    main.className = 'transaction-main';
    const icon = document.createElement('span');
    icon.className = `category-icon ${expense.category.toLowerCase()}`;
    icon.textContent = CATEGORIES[expense.category].icon;
    icon.setAttribute('aria-hidden', 'true');
    const details = document.createElement('div');
    details.style.minWidth = '0';
    const name = document.createElement('div');
    name.className = 'transaction-name';
    name.textContent = expense.name;
    const date = document.createElement('div');
    date.className = 'transaction-date';
    date.textContent = formatDate(expense.date);
    details.append(name, date);
    main.append(icon, details);

    const category = document.createElement('span');
    category.className = 'category-tag';
    category.textContent = expense.category;
    const amount = document.createElement('span');
    amount.className = 'transaction-amount';
    amount.textContent = formatCurrency(expense.amount);
    const remove = document.createElement('button');
    remove.className = 'delete-button';
    remove.type = 'button';
    remove.dataset.expenseId = expense.id;
    remove.setAttribute('aria-label', `Delete ${expense.name}`);
    remove.title = 'Delete expense';
    remove.textContent = '×';
    row.append(main, category, amount, remove);
    list.append(row);
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categoryInput.value;

  if (!name || !Number.isFinite(amount) || amount <= 0 || !Object.hasOwn(CATEGORIES, category)) {
    formError.textContent = 'Enter an item, a positive amount, and choose a category.';
    if (!name) nameInput.focus();
    else if (!Number.isFinite(amount) || amount <= 0) amountInput.focus();
    else categoryInput.focus();
    return;
  }

  formError.textContent = '';
  expenses.push({ id: crypto.randomUUID(), name, amount: Math.round(amount * 100) / 100, category, date: new Date().toISOString() });
  if (!saveExpenses()) {
    expenses.pop();
    return;
  }
  form.reset();
  nameInput.focus();
  render();
});

list.addEventListener('click', (event) => {
  const button = event.target.closest('.delete-button');
  if (!button) return;
  const remaining = expenses.filter((expense) => expense.id !== button.dataset.expenseId);
  const previous = expenses;
  expenses = remaining;
  if (!saveExpenses()) {
    expenses = previous;
    return;
  }
  formError.textContent = '';
  render();
});

document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'long', day: 'numeric'
}).format(new Date());

render();