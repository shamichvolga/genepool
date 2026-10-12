#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборщик всех файлов проекта GenePool в один текстовый файл
с нумерацией строк для каждого файла.
Запуск: python collect_code.py
"""

import os
import sys
from datetime import datetime

# Папки для обхода (в порядке важности для чтения)
DIRS_TO_SCAN = [
    "."
]

# Папки, которые НЕ обходим (служебные, чужой код, старые копии, результаты прогонов)
SKIP_DIRS = {"node_modules", "dist", ".git", ".claude", "GenePool Original", "results", "prof"}

# Расширения файлов, которые собираем
EXTENSIONS = [".ts", ".js", ".cjs", ".css", ".html"]

# Файлы, которые исключаем (бинарные, временные)
EXCLUDE_FILES = [
    "collect_code.py",
    "merge_for_ai.bat",
    "package-lock.json",
    "иерархия папок.bat",
    "структура.txt"
]

# Файлы, которые нужно показать в первую очередь (ключевые для хищности)
PRIORITY_FILES = [
    "src/simulation/Genotype.ts",
    "src/simulation/Embryology.ts",
    "src/simulation/Brain.ts",
    "src/simulation/Swimbot.ts",
    "src/simulation/SwimbotRenderer.ts",
    "src/simulation/GenePool.ts",
    "src/simulation/Parameters.ts",
    "src/simulation/SwimbotTypes.ts"
]

def collect_all_files():
    """Собирает все файлы проекта с их содержимым"""
    all_files = []
    
    for dir_name in DIRS_TO_SCAN:
        if not os.path.exists(dir_name):
            print(f"Предупреждение: папка {dir_name} не найдена, пропускаем")
            continue
            
        for root, dirs, files in os.walk(dir_name):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for file in files:
                # Проверяем расширение
                ext = os.path.splitext(file)[1].lower()
                if ext not in EXTENSIONS:
                    continue
                    
                # Проверяем исключения
                if file in EXCLUDE_FILES:
                    continue
                    
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, start=".")
                all_files.append(rel_path)
    
    return all_files

def sort_files_with_priority(file_list):
    """Сортирует файлы: приоритетные в начале, остальные по алфавиту"""
    priority = []
    other = []
    
    for f in file_list:
        # Нормализуем путь для сравнения
        norm_f = f.replace("\\", "/")
        if norm_f in PRIORITY_FILES:
            priority.append(norm_f)
        else:
            other.append(norm_f)
    
    other.sort()
    priority.sort()
    return priority + other

def write_file_with_line_numbers(f, filepath, out_file):
    """Записывает содержимое файла с нумерацией строк"""
    out_file.write(f"\n{'='*60}\n")
    out_file.write(f"FILE: {filepath}\n")
    out_file.write(f"{'='*60}\n\n")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as src:
            lines = src.readlines()
            
            # Определяем ширину номера строки
            line_width = len(str(len(lines))) + 2
            
            for i, line in enumerate(lines, 1):
                # Удаляем BOM если есть
                if i == 1 and line.startswith('\ufeff'):
                    line = line[1:]
                out_file.write(f"{i:>{line_width}} | {line}")
            
            # Добавляем пустую строку в конце для читаемости
            out_file.write(f"\n")
            
    except Exception as e:
        out_file.write(f"ОШИБКА ЧТЕНИЯ: {e}\n\n")

def main():
    print("=" * 60)
    print("СБОРЩИК КОДА GENE POOL")
    print("=" * 60)
    
    # Собираем все файлы
    all_files = collect_all_files()
    print(f"\nНайдено файлов: {len(all_files)}")
    
    # Сортируем с учётом приоритета
    sorted_files = sort_files_with_priority(all_files)
    
    # Создаём выходной файл
    output_filename = f"genePool_full_code_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    with open(output_filename, 'w', encoding='utf-8') as out:
        # Заголовок
        out.write("=" * 60 + "\n")
        out.write("GENE POOL SWIMBOTS - ПОЛНЫЙ ИСХОДНЫЙ КОД\n")
        out.write(f"Сгенерировано: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write("=" * 60 + "\n\n")
        
        out.write("ПРИОРИТЕТНЫЕ ФАЙЛЫ (для механики хищности):\n")
        out.write("-" * 40 + "\n")
        for i, f in enumerate(sorted_files, 1):
            if f in PRIORITY_FILES:
                out.write(f"  {i}. {f}\n")
        out.write("\n")
        
        out.write("ОСТАЛЬНЫЕ ФАЙЛЫ:\n")
        out.write("-" * 40 + "\n")
        for i, f in enumerate(sorted_files, 1):
            if f not in PRIORITY_FILES:
                out.write(f"  {i}. {f}\n")
        out.write("\n")
        
        out.write("=" * 60 + "\n")
        out.write("НАЧАЛО КОДА\n")
        out.write("=" * 60 + "\n")
        
        # Записываем каждый файл
        for filepath in sorted_files:
            write_file_with_line_numbers(f, filepath, out)
    
    print(f"\nГотово! Файл создан: {output_filename}")
    print(f"Размер: {os.path.getsize(output_filename)} байт")
    print("\nТеперь ты можешь загрузить этот файл в DeepSeek или отправить Кими.")

if __name__ == "__main__":
    main()