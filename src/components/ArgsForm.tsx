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
 * The control for one field, chosen by the kind its schema resolved to.
 *
 * A `switch` rather than the chain of `field.control === "…" ? … : null`
 * blocks this replaced: five mutually exclusive ternaries cost five points of
 * cognitive complexity each time the list is rendered, a switch costs one, and
 * the exclusivity is stated by the language instead of implied.
 *
 * @param props.field The resolved field.
 * @param props.id The control's DOM id, shared with its label and help text.
 * @param props.value What is currently typed, or the field's initial value.
 * @param props.describedBy The help text's id, when there is help text.
 * @param props.disabled Whether a call is in flight.
 * @param props.t Inspector strings in the page's language.
 * @param props.onChange Reports a new value for this field.
 * @param props.onKey Enter submits, except in a textarea.
 * @returns The control, or null for a kind with no control.
 */
function ArgControl({
  field,
  id,
  value,
  describedBy,
  disabled,
  t,
  onChange,
  onKey,
}: Readonly<{
  field: FormField;
  id: string;
  value: string;
  describedBy: string | undefined;
  disabled: boolean;
  t: (typeof ui)[Lang]["insp"];
  onChange: (name: string, value: string) => void;
  onKey: (e: KeyboardEvent) => void;
}>) {
  switch (field.control) {
    case "select": {
      return (
        <select
          id={id}
          disabled={disabled}
          value={value}
          aria-describedby={describedBy}
          onChange={(e) =>
            onChange(field.name, (e.target as HTMLSelectElement).value)
          }
        >
          {/* Vacío el primero: un opcional con enum debe poder no
              mandarse, y sin esta opción el desplegable elegiría el
              primer valor por el visitante. */}
          <option value="">{field.required ? t.pickOne : t.omit}</option>
          {field.options.map((option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ))}
        </select>
      );
    }
    case "checkbox": {
      return (
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          checked={value === "true"}
          aria-describedby={describedBy}
          onChange={(e) =>
            onChange(
              field.name,
              (e.target as HTMLInputElement).checked ? "true" : "",
            )
          }
        />
      );
    }
    case "number": {
      return (
        <input
          id={id}
          type="number"
          disabled={disabled}
          onKeyDown={onKey}
          value={value}
          aria-describedby={describedBy}
          onInput={(e) =>
            onChange(field.name, (e.target as HTMLInputElement).value)
          }
        />
      );
    }
    case "text": {
      return (
        <input
          id={id}
          type="text"
          autocomplete="off"
          spellcheck={false}
          disabled={disabled}
          value={value}
          aria-describedby={describedBy}
          onKeyDown={onKey}
          onInput={(e) =>
            onChange(field.name, (e.target as HTMLInputElement).value)
          }
        />
      );
    }
    case "textarea":
    case "list":
    case "json": {
      return (
        <textarea
          id={id}
          rows={field.control === "textarea" ? 3 : 2}
          spellcheck={false}
          disabled={disabled}
          value={value}
          aria-describedby={describedBy}
          onInput={(e) =>
            onChange(field.name, (e.target as HTMLTextAreaElement).value)
          }
        />
      );
    }
    default: {
      return null;
    }
  }
}

/**
 * One field: its label, its control, and its help line.
 *
 * @param props.field The resolved field.
 * @param props.value What is currently typed, or the field's initial value.
 * @param props.disabled Whether a call is in flight.
 * @param props.t Inspector strings in the page's language.
 * @param props.onChange Reports a new value for this field.
 * @param props.onKey Enter submits, except in a textarea.
 * @returns The field's row.
 */
function ArgField({
  field,
  value,
  disabled,
  t,
  onChange,
  onKey,
}: Readonly<{
  field: FormField;
  value: string;
  disabled: boolean;
  t: (typeof ui)[Lang]["insp"];
  onChange: (name: string, value: string) => void;
  onKey: (e: KeyboardEvent) => void;
}>) {
  const id = `arg-${field.name}`;
  const described = field.description || field.hint;
  const describedBy = described ? `${id}-d` : undefined;

  return (
    <div className="arg">
      <label htmlFor={id}>
        <span className="arg-name">
          {field.name}
          {field.required ? (
            <b
              className="req-mark"
              title={t.required}
            >
              {" *"}
            </b>
          ) : null}
        </span>
        {field.type ? <code className="arg-type">{field.type}</code> : null}
      </label>

      <ArgControl
        field={field}
        id={id}
        value={value}
        describedBy={describedBy}
        disabled={disabled}
        t={t}
        onChange={onChange}
        onKey={onKey}
      />

      {described ? (
        <p
          className="arg-help"
          id={`${id}-d`}
        >
          {field.description}
          {field.description && field.hint ? " · " : ""}
          {field.hint}
        </p>
      ) : null}
    </div>
  );
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
    <div
      className="args"
      data-testid="args-form"
    >
      {fields.map((field) => (
        <ArgField
          key={field.name}
          field={field}
          value={values[field.name] ?? field.initial}
          disabled={disabled}
          t={t}
          onChange={onChange}
          onKey={onKey}
        />
      ))}
    </div>
  );
}
