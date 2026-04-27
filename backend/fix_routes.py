import re

path = r'C:\e-commerce-parapharmacie\backend\src\routes\admin.js'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Ajouter middleware aux routes verifyAdmin (sauf login, verifyAdminOnly)
def should_modify(line):
    if 'verifyAdminOnly' in line:
        return False
    if 'autoCheckEmployeePermission' in line:
        return False
    if re.search(r'router\.(get|post|put|delete|patch)\(.*verifyAdmin,', line):
        return True
    return False

lines = content.split('\n')
new_lines = []
for line in lines:
    if should_modify(line):
        line = re.sub(r'verifyAdmin,\s*(?=async)', 'verifyAdmin, autoCheckEmployeePermission, ', line)
    new_lines.append(line)

new_content = '\n'.join(new_lines)

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Routes modifiées avec succès")