import { Modal } from 'antd';
import type { ModalProps } from 'antd';

// The existing forms/details retain their modal behavior outside Connections.
// In the workspace they render in the right pane, including their save actions.
export default function DetailSurface({ embedded = false, children, title, footer, ...props }: ModalProps & { embedded?: boolean }) {
  if (!embedded) return <Modal {...props} title={title} footer={footer}>{children}</Modal>;
  if (!props.open) return null;
  return <section className={'connection-detail-surface ' + (props.className || '')}>
    {title && <h3>{title}</h3>}
    {children}
    {footer && typeof footer !== 'function' && <div className="connection-detail-footer">{footer}</div>}
  </section>;
}
