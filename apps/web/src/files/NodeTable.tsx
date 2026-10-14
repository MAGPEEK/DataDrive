import { api } from "../api/client";
import type { NodeInfo } from "../api/types";
import { formatBytes, formatDate } from "../format";
import { useI18n } from "../i18n/I18nProvider";

interface NodeTableProps {
  readonly nodes: readonly NodeInfo[];
  readonly canWrite: boolean;
  readonly onOpen: (folder: NodeInfo) => void;
  readonly onTrash: (node: NodeInfo) => void;
}

function NodeName({
  node,
  onOpen,
}: {
  readonly node: NodeInfo;
  readonly onOpen: (n: NodeInfo) => void;
}) {
  if (node.kind === "folder") {
    return (
      <button type="button" className="link" onClick={() => onOpen(node)}>
        <span aria-hidden="true">📁 </span>
        {node.name}
      </button>
    );
  }
  return (
    <span>
      <span aria-hidden="true">📄 </span>
      {node.name}
    </span>
  );
}

export function NodeTable({ nodes, canWrite, onOpen, onTrash }: NodeTableProps) {
  const { t, language } = useI18n();
  if (nodes.length === 0) return <p className="empty">{t("folderEmpty")}</p>;
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t("name")}</th>
          <th scope="col">{t("modified")}</th>
          <th scope="col">{t("size")}</th>
          <th scope="col">{t("actions")}</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map((node) => (
          <tr key={node.id}>
            <td>
              <NodeName node={node} onOpen={onOpen} />
            </td>
            <td>{formatDate(node.modifiedAt, language)}</td>
            <td>{node.kind === "file" ? formatBytes(node.size, language) : "–"}</td>
            <td className="row-actions">
              {node.kind === "file" && (
                <a href={api.downloadUrl(node.id)} download>
                  {t("download")}
                </a>
              )}
              {canWrite && (
                <button type="button" onClick={() => onTrash(node)}>
                  {t("moveToTrash")}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
