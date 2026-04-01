# Azure CLI Troubleshooting

## Login

- **Browser login fails**: Try device code flow: `az login --use-device-code`
- **Clear stale state**: `az account clear && az login`
- **MFA required** (AADSTS50076): Complete the MFA prompt
- **Consent required** (AADSTS65001): Admin must grant consent for the app
- **App not found** (AADSTS700016): Check `--tenant` flag

## Subscription Management

```bash
az account list --output table
az account set --subscription "name-or-id"
az account show
```

## Token Cache

- **macOS/Linux**: Tokens stored as plaintext JSON in `~/.azure/msal_token_cache.json` by default
- **Windows**: DPAPI-encrypted by default. To use plaintext: `az config set core.encrypt_token_cache=false && az login`
- **Token expiry**: Typically 1 hour. Re-acquire: `az account get-access-token --scope '<scope>' -o none`

## Extensions

```bash
az extension list-available --output table | grep <name>
az extension add --name <name>
```

## Reset

```bash
az account clear
az cache purge
az login
```
