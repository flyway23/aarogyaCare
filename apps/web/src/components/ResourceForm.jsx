import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '../lib/zodResolver.js';
import Toast from './Toast.jsx';

const fieldSchema = (field, create) => {
  let schema =
    field.type === 'boolean'
      ? z.boolean()
      : field.type === 'number'
        ? z.coerce.number()
        : field.type === 'email'
          ? z.string().email('Enter a valid email')
          : field.type === 'password' && create && field.createRequired
            ? z.string().min(8)
            : z.string();
  if (field.type === 'select')
    schema = schema.refine(
      (value) => field.options.includes(value),
      'Choose a valid option',
    );
  if (field.type === 'password' && create && field.createRequired)
    return schema;
  if (field.required && field.type !== 'boolean' && field.type !== 'password')
    schema = schema.min(1, 'This field is required');
  return field.required && field.type !== 'boolean'
    ? schema
    : schema
        .optional()
        .or(field.type === 'boolean' ? z.boolean() : z.literal(''));
};

const singular = (title) =>
  title.endsWith('ies')
    ? `${title.slice(0, -3)}y`
    : title.endsWith('s')
      ? title.slice(0, -1)
      : title;

export default function ResourceForm({
  config,
  editing,
  onSubmit,
  onCancel,
  pending,
  error,
}) {
  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(
          Object.entries(config.fields).map(([key, field]) => [
            key,
            fieldSchema(field, !editing),
          ]),
        ),
      ),
    [config, editing],
  );
  const form = useForm({ resolver: zodResolver(schema), defaultValues: {} });
  useEffect(
    () =>
      form.reset(
        Object.fromEntries(
          Object.entries(config.fields).map(([key, field]) => [
            key,
            field.type === 'boolean'
              ? Boolean(editing?.[key] ?? field.defaultValue ?? false)
              : field.type === 'password'
                ? ''
                : (editing?.[key] ?? ''),
          ]),
        ),
      ),
    [config, editing, form.reset],
  );
  return (
    <article className="mt-5 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">
        {editing
          ? `Edit ${singular(config.title)}`
          : `Create ${singular(config.title)}`}
      </h2>
      <form
        onSubmit={form.handleSubmit((values) =>
          onSubmit(
            Object.fromEntries(
              Object.entries(values).filter(
                ([key, value]) => !(key === 'password' && !value),
              ),
            ),
          ),
        )}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        {Object.entries(config.fields).map(([key, field]) => (
          <label
            key={key}
            className="grid gap-1 text-sm font-medium capitalize"
          >
            {key.replaceAll(/([A-Z])/g, ' $1')}
            {field.type === 'select' ? (
              <select
                {...form.register(key)}
                className="rounded-lg border px-3 py-2"
              >
                <option value="">Choose…</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === 'boolean' ? (
              <input
                type="checkbox"
                {...form.register(key)}
                className="h-4 w-4"
              />
            ) : (
              <input
                type={
                  field.type === 'password'
                    ? 'password'
                    : field.type === 'datetime'
                      ? 'datetime-local'
                      : field.type === 'number'
                        ? 'number'
                        : field.type
                }
                {...form.register(key)}
                className="rounded-lg border px-3 py-2"
              />
            )}
            {form.formState.errors[key] && (
              <span className="text-xs text-rose-700">
                {form.formState.errors[key].message}
              </span>
            )}
          </label>
        ))}
        <div className="flex gap-2 sm:col-span-2">
          <button
            disabled={pending}
            className="rounded-lg bg-forest px-4 py-2 font-semibold text-white"
          >
            {editing ? 'Save changes' : 'Create'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border px-4 py-2"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      {error && <Toast message={error} />}
    </article>
  );
}
