#!/usr/bin/env bash
# Connect Hub modifications: preserve upstream installation certificate choices.
# Sourced by the native installer. GPL-3.0.
setup_install_ssl() {
 local choice=2 cert_path key_path
 if [[ -t 2 && -r /dev/tty && -z ${CONNECT_HUB_TLS_MODE+x} ]];then
  printf '\nSSL Certificate Setup / Настройка сертификата HTTPS\n\n'
  printf '  1. Let’s Encrypt — domain / домен\n'
  printf '  2. Let’s Encrypt — IP (default / по умолчанию)\n'
  printf '  3. Custom certificate / свой сертификат\n'
  printf '  4. Skip — reverse proxy or SSH / пропустить\n\n'
  read -r -p 'Choice / Выбор [2]: ' choice </dev/tty || true
  choice=${choice:-2}
  case $choice in
   1) read -r -p 'Domain / Домен: ' CONNECT_HUB_DOMAIN </dev/tty
      [[ -n $CONNECT_HUB_DOMAIN ]] || die 'A domain is required';;
   2) CONNECT_HUB_DOMAIN=;;
   3) read -r -p 'Certificate PEM path / Путь сертификата: ' cert_path </dev/tty
      read -r -p 'Private key PEM path / Путь закрытого ключа: ' key_path </dev/tty
      [[ -f $cert_path && -f $key_path ]] || die 'Certificate or private key does not exist'
      openssl x509 -in "$cert_path" -noout >/dev/null || die 'Invalid certificate'
      openssl pkey -in "$key_path" -noout >/dev/null || die 'Invalid private key'
      [[ $(openssl x509 -in "$cert_path" -pubkey -noout) == $(openssl pkey -in "$key_path" -pubout) ]] || die 'Certificate and private key do not match'
      "$target/connect-hub" setting -webCert "$cert_path" -webCertKey "$key_path"
      return;;
   4) return;;
   *) die 'Invalid certificate choice';;
  esac
 fi
 [[ ${CONNECT_HUB_TLS_MODE:-auto} != off ]] || return 0
 CONNECT_HUB_PREFIX="$prefix" CONNECT_HUB_DATA="$data" CONNECT_HUB_DOMAIN="${CONNECT_HUB_DOMAIN:-}" bash "$target/hub/cert.sh"
}
