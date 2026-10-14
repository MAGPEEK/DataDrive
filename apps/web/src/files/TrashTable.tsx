import type { NodeInfo } from "../api/types";
import { formatDate } from "../format";
import { useI18n } from "../i18n/I18nProvider";

interface TrashTableProps {
  readonly nodes: readonly NodeInfo[];
  readonly onRestore: (node: NodeInfo) => void;
}

export function TrashTable({ nodes, onRestore }: TrashTableProps) {
  const { t, language } = useI18n();
  if (nodes.length === 0) return <p className="empty">{t("trashEmpty")}</p>;
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t("name")}</th>
          <th scope="col">{t("deleted")}</th>
          <th scope="col">{t("actions")}</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((node) => (
          <tr key={node.id}>
            <td>
              <span aria-hidden="true">{node.kind === "folder" ? "📁 " : "📄 "}</span>
              {node.name}
            </td>
            <td>{node.trashedAt === null ? "–" : formatDate(node.trashedAt, language)}</td>
            <td className="row-actions">
              <button type="button" onClick={() => onRestore(node)}>
                {t("restore")}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
