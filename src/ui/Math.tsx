import { Fraction, ProcessVariable, splitFraction } from "../core";

/** Símbolo con subíndice: "D_t" → D<sub>t</sub> */
export function Sym({ s }: { s: string }) {
  if (!s.includes("_")) return <span className="sym">{s}</span>;
  return (
    <span className="sym">
      <MathText text={s} />
    </span>
  );
}

/** Texto con subíndices estilo "D_t/D" → D<sub>t</sub>/D (para relaciones escritas a mano). */
export function MathText({ text }: { text: string }) {
  const parts = text.split(/([^\s_(),=/·]+_[^\s(),=/·]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        const k = p.indexOf("_");
        return k > 0 ? (
          <span key={i}>
            {p.slice(0, k)}
            <sub>{p.slice(k + 1)}</sub>
          </span>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

function Product({ terms }: { terms: { symbol: string; exp: Fraction }[] }) {
  if (!terms.length) return <span className="sym">1</span>;
  return (
    <>
      {terms.map((t, i) => (
        <span key={i} className="factor">
          <Sym s={t.symbol} />
          {!t.exp.equals(Fraction.ONE) && <sup>{t.exp.toString()}</sup>}
        </span>
      ))}
    </>
  );
}

/** Grupo adimensional como fracción tipográfica. */
export function GroupFormula({
  vars,
  exponents,
  termOrder,
}: {
  vars: ProcessVariable[];
  exponents: Fraction[];
  termOrder?: number[];
}) {
  const { num, den } = splitFraction(vars, exponents, termOrder);
  if (!den.length) {
    return (
      <span className="formula">
        <Product terms={num} />
      </span>
    );
  }
  return (
    <span className="formula frac">
      <span className="frac-num">
        <Product terms={num} />
      </span>
      <span className="frac-den">
        <Product terms={den} />
      </span>
    </span>
  );
}
