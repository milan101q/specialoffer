-- SQL script to fix Automax of Chantilly mileage issues
-- This script identifies and updates vehicles from Automax of Chantilly (dealership_id = 19)
-- where the mileage value is the same as the year (likely a data extraction error)

-- First, find how many Automax vehicles might have this issue
SELECT COUNT(*) as total_affected
FROM vehicles 
WHERE dealership_id = 19 -- Automax of Chantilly
AND mileage = year;

-- Show some examples of affected vehicles
SELECT id, title, year, make, model, mileage
FROM vehicles 
WHERE dealership_id = 19 -- Automax of Chantilly
AND mileage = year
LIMIT 10;

-- Update all affected vehicles to set mileage to 0 (unknown)
-- IMPORTANT: This is a dangerous operation, so it's commented out by default.
-- Manually verify the affected vehicles before uncommenting and running this:

/*
UPDATE vehicles 
SET mileage = 0
WHERE dealership_id = 19 -- Automax of Chantilly
AND mileage = year;
*/

-- After running the update, verify no remaining issues
SELECT COUNT(*) as remaining_issues
FROM vehicles 
WHERE dealership_id = 19 -- Automax of Chantilly
AND mileage = year;
