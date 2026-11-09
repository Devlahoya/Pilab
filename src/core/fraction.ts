/**
 * Aritmética racional exacta.
 *
 * El análisis dimensional produce exponentes racionales (p. ej. 1/2, -3/2).
 * Usar fracciones exactas evita errores de redondeo y permite mostrar
 * exponentes "limpios" en los grupos Π.
 */

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

export class Fraction {
  readonly num: number;
  readonly den: number;

  constructor(num: number, den = 1) {
    if (!Number.isInteger(num) || !Number.isInteger(den)) {
      throw new Error(`Fraction requiere enteros (recibió ${num}/${den})`);
    }
    if (den === 0) throw new Error("Denominador cero");
    if (den < 0) {
      num = -num;
      den = -den;
    }
    const g = gcd(num, den) || 1;
    this.num = num / g || 0; // normaliza -0
    this.den = den / g;
  }

  static readonly ZERO = new Fraction(0);
  static readonly ONE = new Fraction(1);

  /** Convierte un número (entero o decimal sencillo como 0.5, 1.5) a fracción. */
  static from(x: number | Fraction): Fraction {
    if (x instanceof Fraction) return x;
    if (Number.isInteger(x)) return new Fraction(x);
    // Aproximación por fracción continua para decimales sencillos
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (let i = 0; i < 20; i++) {
      const a = Math.floor(b);
      [h1, h0] = [a * h1 + h0, h1];
      [k1, k0] = [a * k1 + k0, k1];
      if (Math.abs(x - h1 / k1) < 1e-12) break;
      b = 1 / (b - a);
    }
    return new Fraction(h1, k1);
  }

  add(o: Fraction): Fraction {
    return new Fraction(this.num * o.den + o.num * this.den, this.den * o.den);
  }
  sub(o: Fraction): Fraction {
    return new Fraction(this.num * o.den - o.num * this.den, this.den * o.den);
  }
  mul(o: Fraction): Fraction {
    return new Fraction(this.num * o.num, this.den * o.den);
  }
  div(o: Fraction): Fraction {
    if (o.num === 0) throw new Error("División entre cero");
    return new Fraction(this.num * o.den, this.den * o.num);
  }
  neg(): Fraction {
    return new Fraction(-this.num, this.den);
  }
  isZero(): boolean {
    return this.num === 0;
  }
  isInteger(): boolean {
    return this.den === 1;
  }
  equals(o: Fraction): boolean {
    return this.num === o.num && this.den === o.den;
  }
  sign(): number {
    return Math.sign(this.num);
  }
  abs(): Fraction {
    return new Fraction(Math.abs(this.num), this.den);
  }
  toNumber(): number {
    return this.num / this.den;
  }
  toString(): string {
    return this.den === 1 ? `${this.num}` : `${this.num}/${this.den}`;
  }
}

export const frac = (n: number, d = 1) => new Fraction(n, d);
