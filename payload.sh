#!/bin/sh

# Buat 10 file .txt di ~/ (home directory user)
for i in $(seq 1 10); do
    echo "This is test file $i from VS Code malware simulation" > "$HOME/vscode-test-$i.txt"
done

# Optional: buat file di current working directory (biasanya root project yang dibuka)
touch "INFECTED_BY_TASK.txt"
echo "Payload executed at $(date)" >> "INFECTED_BY_TASK.txt"

# Optional: append ke file yang sering dilihat, misal .bashrc (hati-hati, ini persistent!)
# echo '# VS Code sim' >> "$HOME/.bashrc"

# Buat noise lebih banyak kalau mau
mkdir -p "$HOME/.vscode-malicious"
echo "Malware was here" > "$HOME/.vscode-malicious/proof.txt"

# Supaya terlihat langsung tanpa buka terminal
notify-send "VS Code Payload Executed" "Check your home directory for vscode-test-*.txt" 2>/dev/null || true
