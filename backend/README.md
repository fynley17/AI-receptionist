# RetellCalDashboard - Backend

This folder contains a minimal webhook backend that accepts POST requests from Retell AI and creates bookings in Cal.com using per-customer API keys.

## Files of interest
- `webhook.php` - the webhook endpoint. Accepts JSON and posts bookings to Cal.com.
- `app/Helpers/CalService.php` - wrapper to call Cal.com API.
- `index.php` - minimal front controller that routes `/webhook` to `webhook.php`.
- `config.php` - loads `.env` and returns a PDO instance.

## Required environment variables
- `DB_HOST` - database host
- `DB_NAME` - database name
- `DB_USER` - database user
- `DB_PASS` - database password
- `WEBHOOK_SECRET` - (recommended) HMAC secret for verifying incoming requests

Do NOT commit `.env` to version control.

## Plesk deployment checklist
1. Upload the repository (or deploy via Git) to the domain/subdomain document root.
2. In Plesk Hosting Settings, set the **Document root** to the `backend` directory (so `index.php` is served).
3. Select PHP version (choose as high as your host supports; PHP 8.0+ recommended). Enable `pdo_mysql`, `curl`, `json`, and `openssl` extensions.
4. Configure environment variables (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `WEBHOOK_SECRET`). If Plesk doesn't support environment variables for your plan, create a secure `.env` file with those values.
5. Run Composer on the server in the `backend` directory:

```bash
composer install --no-dev --optimize-autoloader
```

6. Ensure HTTPS is enabled (Let's Encrypt in Plesk).
7. Set file permissions so the web server user can read files; restrict write access. The `logs/` directory will be created automatically for webhook logs.

## Webhook usage
Send a POST with `Content-Type: application/json` to `https://yourdomain/webhook` (or `/webhook.php` for direct file access). Example payloads are in the project root README and earlier code comments.

The endpoint expects at least `agentId` and either `event_type_id` or `event_code` in the JSON. If `WEBHOOK_SECRET` is set, the endpoint expects the header `X-Retell-Signature` containing `hash_hmac('sha256', raw_body, WEBHOOK_SECRET)`.

## Testing locally
Start a local PHP server and POST a JSON body:

```powershell
# from backend folder
php -S localhost:8000

curl -X POST "http://localhost:8000/webhook" -H "Content-Type: application/json" -d '{"agentId":"agent_0ecabee85cc4d8cb88aaf547a4","event_type_id":"evt_123","booking":{"start":"2025-11-21T14:00:00Z","name":"Test","email":"test@example.com"}}'
```

## Notes & next steps
- Add monitoring, logging rotation, and more robust error handling for production. Avoid storing plaintext API keys in backups. Consider a secrets manager for Cal.com API keys.
- If you want, I can add improved logging, retries for transient Cal.com failures, or convert this to a PSR-4 structured controller.
