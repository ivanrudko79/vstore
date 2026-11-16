import appsJson from '../data/apps.json';
import categoriesJson from '../data/categories.json';
import type { AppEntry, Category } from './types';
export const apps = appsJson as AppEntry[];
export const categories = categoriesJson as Category[];
