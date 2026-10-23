// Loads the two methods, then uses them. This file is right as it is: leave it alone.
import { Money } from './money';
import './format';

const total = new Money(450, 'EUR').plus(new Money(1200, 'EUR'));
console.log(total.format());
