import pathlib

try:
    from s2_common import merge_candidate_file
except ImportError:
    from .s2_common import merge_candidate_file

def update_json_with_new_entries(outfile: pathlib.Path, new_entries: list):
    """Backward-compatible wrapper around the stronger S2 merge routine."""
    return merge_candidate_file(outfile, new_entries)
