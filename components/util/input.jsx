import { Input } from "@/styles/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldDescription,
} from "@/styles/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/styles/components/ui/input-group";

export function GuntherInput({
  label = null,
  description = null,
  placeholder = null,
  onChange,
  className,
  prepend = null,
  append = null,
  ...rest
}) {
  return (
    <Field
      className={className}
      {...rest}
    >
      {label && <FieldLabel>{label}</FieldLabel>}
      <InputGroup>
        <InputGroupInput
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <InputGroupAddon align="inline-start">{prepend}</InputGroupAddon>
        <InputGroupAddon align="inline-end">{append}</InputGroupAddon>
      </InputGroup>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}
