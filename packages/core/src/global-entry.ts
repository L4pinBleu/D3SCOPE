import { installGlobal } from './global.js';

// Side effect of the script-tag build: install the API as soon as the file loads.
installGlobal();
