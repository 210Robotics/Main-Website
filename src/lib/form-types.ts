export const formFieldTypes = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "MULTIPLE_CHOICE",
  "MULTI_SELECT",
  "DROPDOWN",
  "DATE",
  "EMAIL",
  "NUMBER",
  "LINK",
  "FILE_UPLOAD",
] as const;

export type FormFieldType = (typeof formFieldTypes)[number];

export type PublicFormField = {
  id: string;
  type: FormFieldType;
  label: string;
  description: string;
  required: boolean;
  options: string[];
  maxFiles?: number;
};

export type FormFileValue = {
  uploadId: string;
  url: string;
  pathname: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type PublicFormAnswer = {
  fieldId: string;
  label: string;
  type: FormFieldType;
  value: string | string[] | FormFileValue[];
};

export const formFieldTypeLabels: Record<FormFieldType, string> = {
  SHORT_TEXT: "Short answer",
  LONG_TEXT: "Paragraph",
  MULTIPLE_CHOICE: "Multiple choice",
  MULTI_SELECT: "Checkboxes",
  DROPDOWN: "Dropdown",
  DATE: "Date",
  EMAIL: "Email",
  NUMBER: "Number",
  LINK: "Website link",
  FILE_UPLOAD: "File upload",
};

export const optionFieldTypes: FormFieldType[] = [
  "MULTIPLE_CHOICE",
  "MULTI_SELECT",
  "DROPDOWN",
];

export function blankFormField(type: FormFieldType): PublicFormField {
  return {
    id: crypto.randomUUID(),
    type,
    label: "Untitled question",
    description: "",
    required: false,
    options: optionFieldTypes.includes(type) ? ["Option 1", "Option 2"] : [],
    maxFiles: type === "FILE_UPLOAD" ? 1 : undefined,
  };
}
