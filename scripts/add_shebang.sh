echo '#!/usr/bin/env node' | cat - "$1" > "$1.bak" && mv "$1.bak" "$1"
