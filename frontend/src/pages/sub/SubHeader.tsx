import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Menu, Popover, Space } from 'antd';
import {
  TranslationOutlined,
  WifiOutlined,
} from '@ant-design/icons';

import { LanguageManager } from '@/utils';

interface SubHeaderProps {
  title: string;
  sId: string;
  email: string;
  lang: string;
  onLangChange: (lang: string) => void;
}

export default function SubHeader({ title, sId, email, lang, onLangChange }: SubHeaderProps) {
  const { t } = useTranslation();
  const langMenuItems = useMemo(
    () =>
      (LanguageManager.supportedLanguages as { value: string; name: string; icon: string }[]).map(
        (l) => ({
          key: l.value,
          label: (
            <Space size={8}>
              <span aria-hidden="true">{l.icon}</span>
              <span>{l.name}</span>
            </Space>
          ),
        }),
      ),
    [],
  );

  const initial = Array.from(title)[0]?.toUpperCase();

  return (
    <header className="sub-header">
      <div className="sub-brand">
        <span className="sub-brand-mark" aria-hidden="true">
          {initial ?? <WifiOutlined aria-hidden />}
        </span>
        <div className="sub-brand-text">
          <div className="sub-brand-title" dir="auto">
            {title || t('subscription.title')}
          </div>
          <div className="sub-brand-id">
            <bdi>{email ? `${sId} - ${email}` : sId}</bdi>
          </div>
        </div>
      </div>
      <div className="sub-toolbar">
        <Popover
          placement="bottomRight"
          trigger="click"
          styles={{ content: { padding: 4 } }}
          content={
            <Menu
              mode="vertical"
              selectable
              selectedKeys={[lang]}
              items={langMenuItems}
              onClick={({ key }) => onLangChange(key)}
              style={{ border: 'none', minWidth: 160 }}
            />
          }
        >
          <Button
            shape="circle"
            size="large"
            className="toolbar-btn"
            aria-label={t('pages.settings.language')}
            icon={<TranslationOutlined aria-hidden />}
          />
        </Popover>
      </div>
    </header>
  );
}
