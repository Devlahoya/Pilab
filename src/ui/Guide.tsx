import { ReactNode } from "react";
import { Sym } from "./Math";

function Section({ n, title, children }: { n?: number; title: string; children: ReactNode }) {
  return (
    <section className="guide-section">
      <h2>
        {n !== undefined && <span className="step">{n}</span>} {title}
      </h2>
      {children}
    </section>
  );
}

export function Guide({ onStart, onLibrary }: { onStart: () => void; onLibrary: () => void }) {
  return (
    <div className="guide">
      <header className="guide-hero">
        <img src="/img/mascota3.jpg" alt="" className="hero-mascot" width={140} height={210} />
        <div>
          <h1>¿Cómo funciona PiLab?</h1>
          <p className="muted">
            PiLab aplica el teorema Π de Buckingham: convierte un problema con muchas variables en uno con pocos
            números adimensionales. Eso permite resumir experimentos, comparar equipos de distinto tamaño y escalar un
            proceso del laboratorio a la planta.
          </p>
          <button className="btn btn-sm" onClick={onLibrary}>
            Ver la biblioteca de números adimensionales →
          </button>
        </div>
      </header>

      <Section title="La idea en tres frases">
        <div className="idea-grid">
          <div className="idea">
            <span className="idea-big">n</span>
            <p>
              Haces una lista de <strong>todas las variables</strong> que influyen en el fenómeno: geometría, velocidades,
              propiedades del fluido y la variable que quieres predecir.
            </p>
          </div>
          <div className="idea">
            <span className="idea-big">r</span>
            <p>
              Esas variables usan <strong>r dimensiones independientes</strong> (masa, longitud, tiempo, temperatura…).
            </p>
          </div>
          <div className="idea idea-strong">
            <span className="idea-big">k = n − r</span>
            <p>
              El fenómeno queda descrito por sólo <strong>k grupos adimensionales</strong>. Por ejemplo, 7 variables de
              un tanque agitado se reducen a 4 números: <Sym s="Po" /> = f(<Sym s="Re" />, <Sym s="Fr" />, <Sym s="D_t/D" />).
            </p>
          </div>
        </div>
      </Section>

      <Section title="¿Por qué agregar o quitar variables?">
        <p>
          La app no adivina la física: <strong>sólo sabe lo que tú le dices</strong>. La lista de variables es tu
          hipótesis sobre qué importa en el proceso. Cada decisión cambia el resultado:
        </p>
        <div className="whatif-grid">
          <div className="whatif">
            <h3>➕ Agregar una variable</h3>
            <p>
              Aparece un grupo adimensional nuevo. Ejemplo: en un tanque agitado, si agregas la tensión superficial{" "}
              <Sym s="σ" />, aparece el número de Weber <Sym s="We" />. Tiene sentido si hay burbujas o gotas.
            </p>
          </div>
          <div className="whatif">
            <h3>➖ Quitar una variable</h3>
            <p>
              Estás suponiendo que no influye, y su grupo desaparece. Ejemplo: si quitas la gravedad <Sym s="g" /> en
              un tanque con deflectores, desaparece el número de Froude <Sym s="Fr" />, porque no se forma vórtice.
            </p>
          </div>
          <div className="whatif">
            <h3>⚠️ Si olvidas una importante</h3>
            <p>
              El análisis será incompleto. PiLab te avisa cuando una variable no puede formar ningún grupo (por
              ejemplo, la única con unidades de temperatura): suele significar que falta otra que la compense.
            </p>
          </div>
          <div className="whatif">
            <h3>🔁 Cambiar el tipo de régimen</h3>
            <p>
              En régimen turbulento la viscosidad casi no influye en la potencia: si quitas <Sym s="μ" /> verás que{" "}
              <Sym s="Po" /> ya no depende de <Sym s="Re" />. Es la base del escalamiento a P/V constante.
            </p>
          </div>
        </div>
      </Section>

      <Section n={1} title="Elige un proceso">
        <p>
          En <strong>Plantillas</strong> hay procesos típicos con sus variables y valores de ejemplo. Son sólo un punto
          de partida: todo es editable. También puedes empezar desde cero.
        </p>
      </Section>

      <Section n={2} title="Revisa las variables">
        <ul>
          <li>
            Marca con <strong>●</strong> la variable que quieres predecir (la «variable de interés»).
          </li>
          <li>
            Escribe las unidades como en tu cuaderno: <code>kg/m3</code>, <code>Pa·s</code>, <code>W/(m²·K)</code>,{" "}
            <code>rpm</code>, <code>cP</code>, <code>L/min</code>, <code>1/h</code>. Debajo verás sus dimensiones.
          </li>
          <li>Los valores son opcionales: con ellos la app calcula cada número y te dice el régimen.</li>
          <li>Con «Agregar variable» puedes buscar por nombre: viscosidad, kLa, diámetro, flujo de gas…</li>
        </ul>
      </Section>

      <Section n={3} title="Lee el resultado">
        <p>
          La relación <Sym s="Π_interés" /> = f(<Sym s="Π_1" />, <Sym s="Π_2" />, …) dice de qué depende tu variable. La
          app prefiere números conocidos (Re, Nu, Po…), pero cualquier combinación de k grupos independientes es igual
          de válida: en «Otros números que se pueden formar» puedes cambiar unos por otros.
        </p>
        <p>
          La pestaña <strong>Procedimiento</strong> muestra el método de variables repetidas paso a paso: matriz
          dimensional, rango y el sistema de ecuaciones de cada grupo.
        </p>
      </Section>

      <Section n={4} title="Ajusta una correlación con tus datos">
        <p>
          El teorema dice de qué grupos depende tu variable, pero la función f sale de experimentos. En{" "}
          <strong>Datos experimentales</strong> pegas tus mediciones desde Excel (una fila por experimento) y la app
          encuentra la correlación <Sym s="Π_0" /> = C·<Sym s="Π_1" />
          <sup>a</sup>·<Sym s="Π_2" />
          <sup>b</sup>… con su incertidumbre, R² y gráficas de colapso y paridad.
        </p>
        <p>
          También te avisa si un grupo no cambió en tus experimentos o si dos grupos cambiaron siempre juntos (por
          ejemplo, si sólo variaste N, Re y Fr crecen a la vez y no se puede saber cuál causa el efecto): es una guía
          para diseñar mejor tus experimentos.
        </p>
      </Section>

      <Section n={5} title="Escala tu proceso">
        <p>
          <strong>Similitud</strong>: si todos los grupos independientes valen lo mismo en el modelo (laboratorio) y en
          el prototipo (planta), el grupo de interés también vale lo mismo. En la sección <strong>Escalamiento</strong>{" "}
          indicas cuánto más grande es la planta y qué se mantiene constante, y la app calcula el resto.
        </p>
        <p>
          Casi nunca se pueden mantener todos los grupos a la vez con el mismo fluido: por ejemplo, Re y Fr constantes
          son incompatibles. La app te dice qué criterios chocan y cuánto cambia cada número para que elijas el que más
          importa (P/V, velocidad de punta, kLa, tiempo de mezclado…). Si ya ajustaste una correlación, puedes usarla
          como criterio para predecir la variable de interés en la planta.
        </p>
      </Section>

      <Section n={6} title="Controla un biorreactor (simulador)">
        <p>
          En <strong>Simulador</strong> hay un biorreactor de tanque agitado con su instrumentación: sensores de oxígeno
          disuelto y temperatura, dos lazos de control PID, alarmas y enclavamientos, dibujado como un diagrama P&amp;ID
          con etiquetas ISA (AIC-101, TIC-102…).
        </p>
        <ul>
          <li>
            El oxígeno se controla en <strong>rango dividido</strong>: primero sube la agitación y, al llegar al máximo, la
            aireación.
          </li>
          <li>
            El kLa se calcula en cada instante con <Sym s="Po" />, <Sym s="Fl" /> y la correlación de van&apos;t Riet: verás
            los mismos números adimensionales del análisis cambiando en vivo.
          </li>
          <li>
            Prueba cambiar la sintonía (Kp, Ti, Td), pasar un lazo a manual o provocar fallas (aire, enfriamiento, sensor
            descalibrado) y observa las tendencias y las alarmas.
          </li>
        </ul>
      </Section>

      <Section n={7} title="Guarda y comparte tus proyectos">
        <p>
          Con una cuenta (botón <strong>Entrar</strong>) puedes guardar análisis y simulaciones con «☁ Guardar en la nube»,
          abrirlos desde cualquier dispositivo en <strong>Mis proyectos</strong> y compartir un enlace de solo lectura con tu
          asesor: quien lo abre recibe una copia para explorar, sin modificar tu original.
        </p>
        <p className="muted small">Sin cuenta todo funciona igual: tu análisis se guarda en este navegador y puedes usar «Guardar archivo».</p>
      </Section>

      <Section title="Glosario rápido">
        <dl className="glossary">
          <dt>Número adimensional</dt>
          <dd>Producto de variables cuyas unidades se cancelan; su valor no depende del sistema de unidades.</dd>
          <dt>Variable de interés</dt>
          <dd>La que quieres predecir o escalar: potencia, kLa, caída de presión, coeficiente h…</dd>
          <dt>Variables repetidas</dt>
          <dd>r variables con dimensiones independientes que se usan para construir todos los grupos.</dd>
          <dt>Similitud geométrica</dt>
          <dd>Modelo y prototipo tienen la misma forma: todas las longitudes cambian en el mismo factor λ.</dd>
          <dt>Similitud parcial</dt>
          <dd>Se mantienen constantes sólo los grupos más importantes porque no es posible mantenerlos todos.</dd>
          <dt>PV, SP y salida</dt>
          <dd>Variable medida (PV), valor deseado (setpoint, SP) y señal que el controlador envía al actuador (0–100 %).</dd>
          <dt>PID</dt>
          <dd>Controlador con acción proporcional (Kp), integral (Ti, elimina el error permanente) y derivativa (Td, anticipa).</dd>
          <dt>Enclavamiento</dt>
          <dd>Acción automática de seguridad que no depende del controlador, p. ej. detener la alimentación con nivel máximo.</dd>
        </dl>
      </Section>

      <div className="guide-cta">
        <button className="btn btn-primary btn-lg" onClick={onStart}>
          Ir a las plantillas
        </button>
      </div>
    </div>
  );
}
