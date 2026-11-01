import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_KEY", "") or os.environ.get("SUPABASE_SECRET_KEY", "")

def get_admin_client() -> Client:
    """Returns an unmutated admin client with full service role key privileges."""
    return create_client(url, key) if url and key else None

# Global client for general operations
supabase: Client = create_client(url, key) if url and key else None

