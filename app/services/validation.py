import re

# Recognized short tokens (1 or 2 letters) that are valid technologies/degrees/acronyms
VALID_SHORT_TOKENS = {
    "c", "r", "go", "ai", "ml", "ui", "ux", "db", "os", "ip", "qa", "it", 
    "c#", "c++", "js", "ts", "php", "sql", "git", "aws", "gcp", "dsa", "oop",
    "bca", "mca", "bba", "mba", "cse", "ece", "eee", "sre", "nlp", "css",
    "b.sc", "m.sc", "b.tech", "m.tech", "b.com", "m.com", "b.des"
}

KNOWN_GIBBERISH_WORDS = {
    "fd", "asd", "asdf", "asdfg", "asdfgh", "asdfghjkl", "qwer", "qwerty", 
    "zxcv", "zxcvb", "hjkl", "test", "testing", "fake", "dummy", "none", 
    "nothing", "na", "n/a", "random", "xyz", "abc", "bla", "blah", "foo", 
    "bar", "gibberish", "123", "1234", "12345", "xxx", "xxxx", "asdfghjk"
}

def is_gibberish_or_fake(text: str) -> bool:
    """
    Checks if text is empty, too short, repetitive, keyboard mash, 
    or contains known fake/dummy values.
    """
    if not text:
        return True
    
    clean = text.strip().lower()
    if len(clean) == 0:
        return True
    
    # Check exact match in known gibberish
    if clean in KNOWN_GIBBERISH_WORDS:
        return True
    
    # Check if single token and very short
    tokens = [t.strip(",. ") for t in clean.split()]
    if len(tokens) == 1:
        tok = tokens[0]
        if tok in KNOWN_GIBBERISH_WORDS:
            return True
        if len(tok) < 2 and tok not in VALID_SHORT_TOKENS:
            return True
        if len(tok) == 2 and tok not in VALID_SHORT_TOKENS:
            # Check if 2 consonants with no vowels (e.g. "fd", "zx", "jk")
            if not any(v in tok for v in "aeiou"):
                return True
    
    # Repeated characters (e.g. "aaaaa", "111111", "zzzz")
    letters_only = re.sub(r"[^a-z0-9]", "", clean)
    if len(letters_only) >= 3 and len(set(letters_only)) <= 1:
        return True
        
    # Keyboard walks
    for pattern in ["asdf", "qwer", "zxcv", "hjkl", "1234", "qwerty", "lkjh"]:
        if pattern in clean:
            return True
            
    # Check long vowel-less tokens (> 3 chars, e.g. "bcdfgh", "sdfg")
    for tok in tokens:
        pure_alpha = re.sub(r"[^a-z]", "", tok)
        if len(pure_alpha) >= 4 and not any(v in pure_alpha for v in "aeiouy"):
            if pure_alpha.upper() not in {"DBMS", "RDBMS", "HTML", "HTTP", "CSS", "JSON", "REST", "GRPC", "SMTP"}:
                return True
                
    return False


def validate_career_request(data: dict) -> tuple[bool, str]:
    """
    Validates input data for 12th pass and final year students.
    Returns (is_valid, error_message).
    """
    student_type = data.get("student_type")
    
    if student_type == "final_year":
        degree = (data.get("degree_major") or "").strip()
        skills = (data.get("current_skills") or "").strip()
        role = (data.get("target_role") or "").strip()
        
        # Check degree
        if not degree:
            return False, "Blueprint doesn't exist. Please check the entered data: Degree and major cannot be blank."
        if is_gibberish_or_fake(degree):
            return False, f"Blueprint doesn't exist. Please check the entered data: '{degree}' is not a recognized degree or major."
            
        # Check skills
        if not skills:
            return False, "Blueprint doesn't exist. Please check the entered data: Please specify at least one skill or technology."
            
        skill_items = [s.strip() for s in skills.split(",") if s.strip()]
        valid_skills = [s for s in skill_items if not is_gibberish_or_fake(s)]
        if not valid_skills:
            return False, f"Blueprint doesn't exist. Please check the entered data: '{skills}' does not contain recognized skills or technologies."
            
        # Check target role
        if not role:
            return False, "Blueprint doesn't exist. Please check the entered data: Target career role cannot be blank."
        if is_gibberish_or_fake(role):
            return False, f"Blueprint doesn't exist. Please check the entered data: '{role}' is not a recognized career role."
            
    elif student_type == "12th_pass":
        interests = (data.get("interests") or "").strip()
        if not interests:
            return False, "Please choose an interest from the suggested topics above or describe your favorite subjects."
        if is_gibberish_or_fake(interests):
            return False, f"'{interests}' does not look like valid subjects or interests. Please choose from the suggested topics above or describe your genuine interests."
            
    return True, ""
