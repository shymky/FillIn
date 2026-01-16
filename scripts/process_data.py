
import csv
import re

def process_raw_data(input_file, output_file):
    data = []
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            if line.startswith('【'):
                continue
            
            # Split by tab or multiple spaces
            parts = re.split(r'\t+|\s{2,}', line)
            
            if len(parts) >= 2:
                japanese = parts[0].strip()
                english = parts[1].strip()
                if japanese and english:
                    data.append({"Japanese": japanese, "English": english})
            else:
                print(f"Skipping line: {line}")

    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["Japanese", "English", "Target Word (Optional)", "Proficiency"])
        writer.writeheader()
        for row in data:
            row["Target Word (Optional)"] = ""
            row["Proficiency"] = 0
            writer.writerow(row)
    
    print(f"Converted {len(data)} lines to {output_file}")

if __name__ == "__main__":
    process_raw_data("data/raw_data.txt", "data/vocab.csv")
