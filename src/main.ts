import "./styles.css";
import { load } from "./state";
import { render } from "./render";
import { initAuth } from "./auth";

// Boot
load();
render();
initAuth();
