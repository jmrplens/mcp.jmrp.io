import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import type { FormField } from "../lib/tool-schema";

/**
 * The arguments form, generated from the schema.
 *
 * It replaces the raw JSON field that used to be here. Raw JSON is the
 * interface an LLM needs: it requires knowing the property names, their types
 * and which are required by heart. A person needs to see the fields, which
 * ones they must fill in, and what values each one accepts.
 *
 * JSON mode is still there, but as an escape hatch: there are schemas with
 * `oneOf`, `$ref` or composition that no honest form can represent.
 */

export interface ArgsFormProps {
  fields: FormField[];
  /** Enter in a single-line control fires the call. */
  onSubmit?: () => void;
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  lang: Lang;
  /** The controls lock while a call is in flight. */
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
          {/* The empty one first: an optional with an enum must be allowed to
              go unsent, and without this option the dropdown would pick the
              first value on the visitor's behalf. */}
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
/**
 * What a control expects, in one line, under the field.
 *
 * It lives here and not on `FormField` because it is presentation, not schema:
 * baking it into `formFields` meant one hardcoded string for every reader, and
 * the string that got baked in was Spanish — so an English visitor read a
 * Spanish sentence under every array field.
 *
 * @param control The control the property resolved to.
 * @param t Inspector strings in the page's language.
 * @returns The hint, or an empty string when the format is self-evident.
 */
function hintFor(
  control: FormField["control"],
  t: (typeof ui)[Lang]["insp"],
): string {
  if (control === "list") return t.hintList;
  if (control === "json") return t.hintJson;
  return "";
}

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
  const hint = hintFor(field.control, t);
  const described = field.description || hint;
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
          {field.description && hint ? " · " : ""}
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Renders one control per schema property.
 *
 * @param props.fields The fields `formFields` already resolved.
 * @param props.values What has been typed so far, by property name.
 * @param props.onChange Called with the name and the new value.
 * @param props.lang The page's language.
 * @param props.disabled Whether the controls are locked.
 * @returns The form, or a notice when the tool takes no arguments.
 */
export default function ArgsForm({
  fields,
  values,
  onChange,
  onSubmit,
  lang,
  disabled,
}: Readonly<ArgsFormProps>) {
  /** Enter submits, except in a textarea, where it is a legitimate newline. */
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
