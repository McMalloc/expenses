import * as Calendar from './Calendar.js';
import * as DayExpenses from './DayExpenses.js';
import * as Form from './Form.js';
import * as ManageTags from './ManageTags.js';
import * as MonthChart from './MonthChart.js';
import * as Navbar from './Navbar.js';
import * as Overview from './Overview.js';
import * as constants from './constants.js';
import * as dates from './dates.js';
import * as expenses from './expenses.js';
import * as labels from './labels.js';

import ExpensesError from './ExpensesError.js';
import state from './state.js';

document.onkeydown = e => {
  if (e.key === 'Enter') {
    if (['description', 'amount', 'currency-input', 'date-input', 'exchange-rate', 'recurring-checkbox', 'recurring-frequency', 'recurring-monthly', 'recurring-yearly', 'recurring-from', 'recurring-to', 'type-select'].includes(e.target.id)) {
      if (e.ctrlKey) {
        Form.submit();
      }
      // disable Enter-only for submitting
      return false;
    }
  }
  if (e.key === 'Escape') {
    cancelLineEdit();
    return false;
  }
  if (e.ctrlKey) {
    if (e.key === 'Insert') {
      startNew();
      return false;
    }
  }
  if ((e.target.id === 'description' && e.key === 'ArrowDown') || e.key === 'ArrowUp') {
    if (!Form.getProposalField().querySelector('option')) {
      return false;
    }
    const selectedOption = Form.getProposalField().querySelector('option:checked');
    let sibling;
    if (!selectedOption || !(sibling = e.key === 'ArrowDown' ? selectedOption.nextElementSibling : selectedOption.previousElementSibling)) {
      sibling = e.key === 'ArrowDown' ? Form.getProposalField().querySelector('option:first-child') : Form.getProposalField()().querySelector('option:last-child');
    }
    sibling.selected = true;
    Form.getDescriptionInput().value = sibling.value;
    if (typeof state.descriptionCaretPosition === 'number') {
      Form.getDescriptionInput().setSelectionRange(state.descriptionCaretPosition, state.descriptionCaretPosition);
    }
    return false;
  }
  return true;
};

/*
 * Data store
 */
function setDate(date) {
  if (dates.isSameDay(date, state.date)) {
    return;
  }
  if (!dates.isSameMonth(date, state.date)) {
    state.daysOfMonth.loadState = 'dirty';
    state.overviewData.loadState = 'dirty';
  }
  state.dayExpenses.loadState = 'dirty';
  state.date = date;
  render();
}

function getCurrentDayString() {
  return dates.toYmd(state.date);
}

/*
 * UI
 */

function getAppArea() {
  return document.getElementById('app-area');
}

function getNavbar() {
  return document.getElementById('navbar');
}

function renderFloat(f) {
  return constants.numberFormat.format(f);
}

function renderDay(date) {
  return constants.dayFormat.format(date);
}

function renderDayHeading(date) {
  return constants.dayHeadingFormat.format(date);
}

function decorateTags(text, wrapperFunction) {
  wrapperFunction = wrapperFunction || (x => x);

  const parts = [];
  for (let i = 0, m; m = constants.labelRegex.exec(text); ++i) {
    if (i === 0 && m.index > 0) {
      parts.push(text.substring(0, m.index).trim());
    }
    parts.push(labels.render(m[1]));
    ++i;
  }
  if (parts.length === 0) {
    parts.push(text);
  }

  return parts
    .map(wrapperFunction)
    .join(' ');
}

function setMonthDisplay(monthDisplay) {
  if (monthDisplay === state.monthDisplay) {
    return;
  }
  state.monthDisplay = monthDisplay;
  localStorage.setItem('monthDisplay', monthDisplay);
  render();
}

function setViewMode(viewMode) {
  state.form = null;
  state.viewMode = viewMode;
  render();
}

function renderMainArea() {
  const items = {
    overview: {
      icon: 'eyeglasses',
      name: 'Übersicht',
      callback: Overview.render
    },
    calendar: {
      icon: 'calendar3',
      name: 'Kalender',
      callback: Calendar.render
    },
    chart: {
      icon: 'graph-up',
      name: 'Diagramm',
      callback: MonthChart.render
    }
  };

  const lis = Object.entries(items)
    .map(en => {
      const [item, props] = en;
      return `
        <li class="nav-item">
            <a class="nav-link ${state.monthDisplay === item ? 'active' : ''}" onclick="setMonthDisplay('${item}');" href="#"><i class="bi-${props.icon}"></i><span class="d-none d-sm-inline">&nbsp;${props.name}</span></a>
        </li>`;
    });

  const content = items[state.monthDisplay].callback();

  return `
        <div class="col-lg-8 mt-content">
            <ul class="nav nav-tabs mb-2">
                ${lis.join('\n')}
            </ul>
            <div class="mb-4">
                ${content}
            </div>
        </div>`;
}

function render() {
  labels.refresh();
  getNavbar().innerHTML = Navbar.render();
  Navbar.onAttach();

  let appArea;
  let expenseForm;
  if (state.viewMode === 'monthDisplay') {
    const mainArea = renderMainArea();
    const dayTable = DayExpenses.render();
    expenseForm = Form.render();
    appArea = mainArea + dayTable + expenseForm;
  } else if (state.viewMode === 'manageTags') {
    appArea = ManageTags.render();
  }
  getAppArea().innerHTML = appArea;
  if (state.viewMode === 'manageTags') {
    ManageTags.onAttach();
  }
  if (state.viewMode === 'monthDisplay') {
    if (state.monthDisplay === 'chart') {
      MonthChart.onAttach();
    }
    if (state.monthDisplay === 'calendar') {
      Calendar.onAttach();
    }
  }
  if (expenseForm) {
    Form.onAttach();
  }

  const collapsibles = document.querySelectorAll('.collapse');
  if (collapsibles) {
    collapsibles.forEach(n => {
      n.addEventListener('show.bs.collapse', e => { saveExpandedPath(e.target.id); });
      n.addEventListener('hide.bs.collapse', e => { removeExpandedPath(e.target.id); });
    });
  }

  const expenseElems = document.querySelectorAll('[data-xpns-id]:not([data-xpns-id=""])');
  for (const li of expenseElems) {
    li.addEventListener('click', editExpense);
  }
}

function saveExpandedPath(newPath) {
  const components = newPath.split('-');

  let expandedPath = state.expandedPaths;
  for (let component of components) {
    expandedPath = (expandedPath[component] = expandedPath[component] || {});
  }
}

function removeExpandedPath(path) {
  const components = path.split('-');

  let expandedPath = state.expandedPaths;
  components.forEach((component, i) => {
    if (i === components.length - 1) {
      expandedPath[component] = null;
      return;
    }
    expandedPath = expandedPath[component];
  });
}


function isDefaultCurrency(currency) {
  return currency === constants.DEFAULT_CURRENCY;
}

function editExpense(evt) {
  evt.preventDefault();

  startEditPosition(evt.currentTarget.dataset.xpnsId);
}

function startNew() {
  state.form = 'new';
  state.editedPosition.data = expenses.prepareCreate();
  state.editedPosition.loadState = 'loaded';
  render();
}

function startEditPosition(id) {
  state.form = 'edit';
  state.editedPosition.data = { _id: id };
  state.editedPosition.loadState = 'dirty';
  render();
}

function cancelLineEdit() {
  state.form = null;
  state.editedPosition.loadState = 'loaded';
  state.editedPosition.data = null;
  render();
}

async function removeExpense() {
  await expenses.deletePosition(state.editedPosition.data);

  state.form = null;
  state.editedPosition.loadState = 'loaded';
  state.editedPosition.data = null;
  render();
}

window.onerror = (msg, url, lineNo, columnNo, error) => {
  if (error instanceof ExpensesError) {
    error.origins.forEach(o => o.classList.add('error'))
    alert(error.message);
    return;
  }
  throw error;
};

async function onAttach() {
  window.setMonthDisplay = setMonthDisplay;

  render();
}

export {
  cancelLineEdit,
  decorateTags,
  getCurrentDayString,
  isDefaultCurrency,
  removeExpense,
  render,
  renderDay,
  renderDayHeading,
  renderFloat,
  setDate,
  setMonthDisplay,
  setViewMode,
  startEditPosition,
  startNew,
  onAttach
};
