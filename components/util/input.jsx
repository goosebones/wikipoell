import { Input } from "@/styles/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldDescription,
} from "@/styles/components/ui/field";

export function GuntherInput({
  label = null,
  description = null,
  placeholder = null,
  onChange,
  className,
  ...rest
}) {
  return (
    <Field
      className={className}
      {...rest}
    >
      {label && <FieldLabel>{label}</FieldLabel>}
      <Input
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}
