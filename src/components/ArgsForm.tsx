import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import type { FormField } from "../lib/tool-schema";

/**
 * Formulario de argumentos, generado del esquema.
 *
 * Sustituye al campo de JSON crudo que había antes. El JSON crudo es la
 * interfaz que necesita un LLM: obliga a saberse de memoria los nombres de las
 * propiedades, su tipo y cuáles son obligatorias. Una persona necesita ver los
 * campos, cuáles tiene que rellenar y qué valores admite cada uno.
 *
 * El modo JSON sigue estando, pero como escape: hay esquemas con `oneOf`,
 * `$ref` o composición que ningún formulario honesto puede representar.
 */

export interface ArgsFormProps {
  fields: FormField[];
  /** Enter en un control de una línea lanza la llamada. */
  onSubmit?: () => void;
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  lang: Lang;
  /** Los controles se bloquean mientras hay una llamada en vuelo. */
  disabled: boolean;
}

/**
 * Pinta un control por propiedad del esquema.
 *
 * @param props.fields Campos ya resueltos por `formFields`.
 * @param props.values Lo tecleado hasta ahora, por nombre de propiedad.
 * @param props.onChange Se llama con el nombre y el valor nuevo.
 * @param props.lang Idioma de la página.
 * @param props.disabled Si los controles están bloqueados.
 * @returns El formulario, o un aviso si la tool no admite argumentos.
 */
export default function ArgsForm({
  fields,
  values,
  onChange,
  onSubmit,
  lang,
  disabled,
}: Readonly<ArgsFormProps>) {
  /** Enter envía, salvo en textarea, donde es un salto de línea legítimo. */
  function onKey(e: KeyboardEvent) {
    if (!(e.key === "Enter" && onSubmit)) {
    	return;
    }

    e.preventDefault();
    onSubmit();
  }
  const t = ui[lang].insp;

  if (fields.length === 0) {
    return <p className="tool-hint">{t.noArgs}</p>;
  }

  return (
    <div className="args" data-testid="args-form">
      {fields.map((field) => {
        const id = `arg-${field.name}`;
        const value = values[field.name] ?? field.initial;
        const described = field.description || field.hint;

        return (
          <div className="arg" key={field.name}>
            <label htmlFor={id}>
              <span className="arg-name">
                {field.name}
                {field.required ? (
                  <b className="req-mark" title={t.required}>
                    {" *"}
                  </b>
                ) : null}
              </span>
              {field.type ? <code className="arg-type">{field.type}</code> : null}
            </label>

            {field.control === "select" ? (
              <select
                id={id}
                disabled={disabled}
                value={value}
                aria-describedby={described ? `${id}-d` : undefined}
                onChange={(e) =>
                  onChange(field.name, (e.target as HTMLSelectElement).value)
                }
              >
                {/* Vacío el primero: un opcional con enum debe poder no
                    mandarse, y sin esta opción el desplegable elegiría el
                    primer valor por el visitante. */}
                <option value="">{field.required ? t.pickOne : t.omit}</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : null}

            {field.control === "checkbox" ? (
              <input
                id={id}
                type="checkbox"
                disabled={disabled}
                checked={value === "true"}
                aria-describedby={described ? `${id}-d` : undefined}
                onChange={(e) =>
                  onChange(
                    field.name,
                    (e.target as HTMLInputElement).checked ? "true" : "",
                  )
                }
              />
            ) : null}

            {field.control === "number" ? (
              <input
                id={id}
                type="number"
                disabled={disabled}
                onKeyDown={onKey}
                value={value}
                aria-describedby={described ? `${id}-d` : undefined}
                onInput={(e) =>
                  onChange(field.name, (e.target as HTMLInputElement).value)
                }
              />
            ) : null}

            {field.control === "text" ? (
              <input
                id={id}
                type="text"
                autocomplete="off"
                spellcheck={false}
                disabled={disabled}
                value={value}
                aria-describedby={described ? `${id}-d` : undefined}
                onKeyDown={onKey}
                onInput={(e) =>
                  onChange(field.name, (e.target as HTMLInputElement).value)
                }
              />
            ) : null}

            {["textarea", "list", "json"].includes(field.control) ? (
              <textarea
                id={id}
                rows={field.control === "textarea" ? 3 : 2}
                spellcheck={false}
                disabled={disabled}
                value={value}
                aria-describedby={described ? `${id}-d` : undefined}
                onInput={(e) =>
                  onChange(field.name, (e.target as HTMLTextAreaElement).value)
                }
              />
            ) : null}

            {described ? (
              <p className="arg-help" id={`${id}-d`}>
                {field.description}
                {field.description && field.hint ? " · " : ""}
                {field.hint}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
