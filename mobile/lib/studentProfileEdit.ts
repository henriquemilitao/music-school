// lib/studentProfileEdit.ts
//
// Formulário "Editar dados cadastrais" (aluno + responsável): valores
// iniciais, validação e corpo enviado à API. Sem tela nenhuma.
import { isValidEmail } from './validation';
import { maskPhone, parseDate } from './newStudent';
import type { UpdateProfileBody } from './studentAdmin';

export type ProfileForm = {
  studentName: string;
  birthDate: string; // DD/MM/AAAA ('' = não informada)
  guardianName: string;
  guardianPhone: string; // mascarado
  guardianEmail: string;
};

export type ProfileFormErrors = Partial<Record<keyof ProfileForm, string>>;

type StudentSource = {
  name: string;
  birthDate: string | null;
  user: { name: string; email: string; phone: string | null };
};

const onlyDigits = (text: string) => text.replace(/\D/g, '');

// A data de nascimento é guardada como data pura (meia-noite UTC): lemos o
// texto "AAAA-MM-DD" direto, sem passar pelo fuso do aparelho.
function isoToBrDate(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function initialProfileForm(student: StudentSource): ProfileForm {
  return {
    studentName: student.name,
    birthDate: isoToBrDate(student.birthDate),
    guardianName: student.user.name,
    guardianPhone: maskPhone(student.user.phone ?? ''),
    guardianEmail: student.user.email,
  };
}

export function isProfileDirty(initial: ProfileForm, form: ProfileForm) {
  return (Object.keys(initial) as (keyof ProfileForm)[]).some(
    (key) => initial[key] !== form[key],
  );
}

export function validateProfileForm(form: ProfileForm): ProfileFormErrors {
  const errors: ProfileFormErrors = {};

  if (!form.studentName.trim()) errors.studentName = 'Informe o nome do aluno';

  if (form.birthDate) {
    const iso = parseDate(form.birthDate);
    if (!iso) errors.birthDate = 'Data inválida. Use DD/MM/AAAA';
    else if (iso > new Date().toISOString().slice(0, 10)) {
      errors.birthDate = 'A data de nascimento não pode ser no futuro';
    }
  }

  if (!form.guardianName.trim())
    errors.guardianName = 'Informe o nome do responsável';

  if (!form.guardianEmail.trim()) {
    errors.guardianEmail = 'Informe o e-mail';
  } else if (!isValidEmail(form.guardianEmail)) {
    errors.guardianEmail = 'E-mail inválido. Confira e tente de novo';
  }

  if (form.guardianPhone && onlyDigits(form.guardianPhone).length < 10) {
    errors.guardianPhone = 'Telefone incompleto. Inclua o DDD';
  }

  return errors;
}

// Só os campos alterados. Telefone vazio ("") remove o telefone no servidor.
export function buildProfileBody(
  initial: ProfileForm,
  form: ProfileForm,
): UpdateProfileBody {
  const body: UpdateProfileBody = {};
  if (form.studentName !== initial.studentName)
    body.name = form.studentName.trim();
  if (form.birthDate !== initial.birthDate && form.birthDate) {
    body.birthDate = parseDate(form.birthDate) ?? undefined;
  }
  if (form.guardianName !== initial.guardianName)
    body.guardianName = form.guardianName.trim();
  if (form.guardianEmail !== initial.guardianEmail)
    body.guardianEmail = form.guardianEmail.trim().toLowerCase();
  if (form.guardianPhone !== initial.guardianPhone)
    body.guardianPhone = onlyDigits(form.guardianPhone);
  return body;
}
