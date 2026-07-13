import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import {
  approveLine,
  getImportedFile,
  listImportedFiles,
  listImportedLines,
  rejectLine,
  startImport,
  undoLineStatus,
  updateImportedLine,
  type ImportedFile,
  type ImportedTransactionLine,
  type StartImportInput,
} from "./imports-api";

export function useImportedFiles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["imported_files", user?.id],
    queryFn: () => listImportedFiles(user!.id),
    enabled: !!user,
  });
}

export function useImportedFile(fileId: string | null) {
  return useQuery({
    queryKey: ["imported_file", fileId],
    queryFn: () => getImportedFile(fileId!),
    enabled: !!fileId,
  });
}

export function useImportedLines(fileId: string | null) {
  return useQuery({
    queryKey: ["imported_lines", fileId],
    queryFn: () => listImportedLines(fileId!),
    enabled: !!fileId,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, userId?: string) {
  qc.invalidateQueries({ queryKey: ["imported_files", userId] });
  qc.invalidateQueries({ queryKey: ["transactions", userId] });
  qc.invalidateQueries({ queryKey: ["invoices", userId] });
  qc.invalidateQueries({ queryKey: ["dashboard", userId] });
  qc.invalidateQueries({ queryKey: ["accounts", userId] });
  qc.invalidateQueries({ queryKey: ["credit_cards", userId] });
}

export function useStartImport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartImportInput) => startImport(user!.id, input),
    onSuccess: () => invalidateAll(qc, user?.id),
    onError: () => invalidateAll(qc, user?.id),
  });
}

export function useUpdateImportedLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
      fileId,
    }: {
      id: string;
      patch: Partial<ImportedTransactionLine>;
      fileId: string;
    }) => updateImportedLine(id, patch).then(() => fileId),
    onSuccess: (fileId) => {
      qc.invalidateQueries({ queryKey: ["imported_lines", fileId] });
    },
  });
}

export function useApproveLine() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      line,
      file,
    }: {
      line: ImportedTransactionLine;
      file: ImportedFile;
    }) => approveLine(user!.id, line, file),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["imported_lines", vars.file.id] });
      invalidateAll(qc, user?.id);
    },
  });
}

export function useRejectLine() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      line,
      file,
    }: {
      line: ImportedTransactionLine;
      file: ImportedFile;
    }) => rejectLine(line, file),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["imported_lines", vars.file.id] });
      invalidateAll(qc, user?.id);
    },
  });
}

export function useUndoLine() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      line,
      file,
    }: {
      line: ImportedTransactionLine;
      file: ImportedFile;
    }) => undoLineStatus(line, file),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["imported_lines", vars.file.id] });
      invalidateAll(qc, user?.id);
    },
  });
}
