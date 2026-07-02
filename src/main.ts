import "./styles.css";
import { MONTHS } from "./constants";
import { load, state } from "./state";
import { render } from "./render";
import { initAuth } from "./auth";

// Boot
load();
render();
initAuth();

let calendarYear = new Date().getFullYear();
let calendarMonth = MONTHS[new Date().getMonth()];

setInterval(() => {
  const now = new Date();
  const nextYear = now.getFullYear();
  const nextMonth = MONTHS[now.getMonth()];
  if (nextYear === calendarYear && nextMonth === calendarMonth) return;

  const wasOnCurrentYear = state.year === calendarYear;
  const wasOnCurrentMonth = state.summaryMonth === calendarMonth;
  const wasActiveCurrentMonth = state.activeMonth === calendarMonth;
  const wasSourceCurrentMonth = state.sourceMonth === calendarMonth;
  const wasResetCurrentYear = state.resetYear === String(calendarYear);
  const wasResetCurrentMonth = state.resetMonth === calendarMonth;

  calendarYear = nextYear;
  calendarMonth = nextMonth;

  if (wasOnCurrentYear) state.year = nextYear;
  if (wasOnCurrentMonth) state.summaryMonth = nextMonth;
  if (wasActiveCurrentMonth) state.activeMonth = nextMonth;
  if (wasSourceCurrentMonth) state.sourceMonth = nextMonth;
  if (wasResetCurrentYear) state.resetYear = String(nextYear);
  if (wasResetCurrentMonth) state.resetMonth = nextMonth;

  render();
}, 60000);
