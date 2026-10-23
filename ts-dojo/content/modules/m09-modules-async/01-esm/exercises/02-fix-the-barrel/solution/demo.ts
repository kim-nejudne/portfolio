import { add, format, money, type FormatOptions } from './index';

const display: FormatOptions = { symbol: true };
const total = add(money(450, 'EUR'), money(1275, 'EUR'));
console.log(format(total, display));
