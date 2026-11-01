import { installGlobal } from './global.js';
import { defineChartElement } from './element/index.js';

// Side effect of the script-tag build: install the API and the <d3scope-chart> element.
installGlobal();
if (typeof customElements !== 'undefined') defineChartElement();
