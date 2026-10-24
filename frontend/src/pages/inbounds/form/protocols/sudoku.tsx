import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/form/rhf';

export default function SudokuFields() {
  const { t } = useTranslation();
  return (
    <>
      <FormField name={['settings', 'aead']} label={t('pages.inbounds.form.sudokuEncryption')}>
        <Select
          options={['chacha20-poly1305', 'aes-128-gcm', 'none'].map((value) => ({
            value,
            label: value,
          }))}
        />
      </FormField>
      <FormField name={['settings', 'table']} label={t('pages.inbounds.form.sudokuTable')}>
        <Select
          options={[
            'prefer_ascii',
            'prefer_entropy',
            'up_ascii_down_entropy',
            'up_entropy_down_ascii',
          ].map((value) => ({ value, label: value }))}
        />
      </FormField>
    </>
  );
}
