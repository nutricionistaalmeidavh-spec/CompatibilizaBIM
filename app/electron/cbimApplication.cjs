'use strict';

const COMMANDS = new Set(['StartConversion','CancelConversion','OpenProject']);
const QUERIES = new Set(['GetHistory']);

function createCbimApplication({ convertDwg, cancelConversion, listWorkspaces, openStudio }) {
  if (![convertDwg,cancelConversion,listWorkspaces,openStudio].every(fn => typeof fn === 'function')) {
    throw new TypeError('CBIM application dependencies are required.');
  }
  return Object.freeze({
    async execute(command, context = {}) {
      if (!COMMANDS.has(command)) throw new Error('Unsupported CBIM command: ' + command);
      if (command === 'StartConversion') return convertDwg(context);
      if (command === 'CancelConversion') return cancelConversion();
      if (command === 'OpenProject') return openStudio(context);
    },
    async query(query, context = {}) {
      if (!QUERIES.has(query)) throw new Error('Unsupported CBIM query: ' + query);
      if (query === 'GetHistory') return listWorkspaces(context.documentsDir);
    }
  });
}

module.exports = { createCbimApplication, COMMANDS, QUERIES };
