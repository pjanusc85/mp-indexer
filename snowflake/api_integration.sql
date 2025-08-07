-- Snowflake API Integration for Money Protocol Indexer
-- This creates an API integration to connect Snowflake with the GitHub repository

-- Create API integration for Git access
CREATE OR REPLACE API INTEGRATION mp_indexer
    API_PROVIDER = git_https_api
    API_ALLOWED_PREFIXES = ('https://github.com/pjanusc85/mp-indexer.git')
    ENABLED = true
    ALLOWED_AUTHENTICATION_SECRETS = all
    COMMENT = 'API integration for Money Protocol indexer repository on GitHub';

-- Verify the integration was created
DESCRIBE API INTEGRATION mp_indexer;

-- Create Git repository in Snowflake
CREATE OR REPLACE GIT REPOSITORY mp_indexer_repo
    API_INTEGRATION = mp_indexer
    ORIGIN = 'https://github.com/pjanusc85/mp-indexer.git';

-- List files in the repository
LS @mp_indexer_repo/branches/main;

-- Fetch the latest changes
ALTER GIT REPOSITORY mp_indexer_repo FETCH;