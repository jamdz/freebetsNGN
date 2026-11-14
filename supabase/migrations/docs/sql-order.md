# SQL migration order

Apply the migration files in this order:

1. `20261020000000_core_backend.sql`
2. `20261022000000_predictions_optional_scores.sql`
3. `20261023000000_remove_leagues.sql`
4. `20261024000000_prize_awards_created_at.sql`
5. `20261025000000_admin_operations.sql`
6. `20261026000000_admin_operations_fixes.sql`
7. `20261027000000_admin_list_helpers.sql`
8. `20261028000000_money_features.sql`
9. `20261029000000_admin_config_tables.sql`
10. `20261030000000_rate_limits_and_storage.sql`

The last three SQL files are listed for order tracking only and are intentionally not included here.
