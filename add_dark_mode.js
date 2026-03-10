import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('src', (filepath) => {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
    let content = fs.readFileSync(filepath, 'utf8');
    
    let modified = content
      .replace(/bg-white(?!\s+dark:bg)/g, 'bg-white dark:bg-gray-800')
      .replace(/bg-gray-50(?!\s+dark:bg)/g, 'bg-gray-50 dark:bg-gray-900')
      .replace(/text-gray-900(?!\s+dark:text)/g, 'text-gray-900 dark:text-gray-50')
      .replace(/text-gray-800(?!\s+dark:text)/g, 'text-gray-800 dark:text-gray-100')
      .replace(/text-gray-700(?!\s+dark:text)/g, 'text-gray-700 dark:text-gray-200')
      .replace(/text-gray-600(?!\s+dark:text)/g, 'text-gray-600 dark:text-gray-300')
      .replace(/text-gray-500(?!\s+dark:text)/g, 'text-gray-500 dark:text-gray-400')
      .replace(/border-gray-100(?!\s+dark:border)/g, 'border-gray-100 dark:border-gray-800')
      .replace(/border-gray-200(?!\s+dark:border)/g, 'border-gray-200 dark:border-gray-700')
      .replace(/border-gray-300(?!\s+dark:border)/g, 'border-gray-300 dark:border-gray-600')
      .replace(/bg-gray-100(?!\s+dark:bg)/g, 'bg-gray-100 dark:bg-gray-800')
      .replace(/bg-gray-200(?!\s+dark:bg)/g, 'bg-gray-200 dark:bg-gray-700');
      
    if (content !== modified) {
      fs.writeFileSync(filepath, modified);
      console.log('Modified', filepath);
    }
  }
});
