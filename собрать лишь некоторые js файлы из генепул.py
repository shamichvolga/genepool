#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Оптимизированный сборщик кода GenePool для хищности.
Собирает ТОЛЬКО файлы критичные для реализации охоты, еды и поведения.
Исключает визуализацию, CSS, HTML и другой балласт.

Запуск: python collect_predation_code.py
"""

import os
import sys
from datetime import datetime

# ─────────────────────────────────────────────────────────────
# КРИТИЧНЫЕ ФАЙЛЫ для хищности (в порядке чтения)
# ─────────────────────────────────────────────────────────────
CRITICAL_FILES = [
    "src/simulation/Parameters.ts",           # константы (SWIMBOT_MOUTH_LENGTH, INITIAL_NUM_SWIMBOTS и т.д.)
    "src/simulation/Genotype.ts",             # структура генов
    "src/simulation/Embryology.ts",           # ген 51 → predatorLevel
    "src/simulation/Brain.ts",                # состояния LOOKING_FOR_PREY, PURSUING_PREY
    "src/simulation/FoodBit.ts",              # типы еды (0, 1, 2), цвета
    "src/simulation/Swimbot.ts",              # поведение, huntEatChosenPrey, die()
    "src/simulation/GenePool.ts",             # главный цикл, поиск добычи, спаун мяса
]

# ─────────────────────────────────────────────────────────────
# Файлы, которые ИСКЛЮЧАЕМ (не нужны для хищности)
# ─────────────────────────────────────────────────────────────
EXCLUDE_PATTERNS = [
    # Визуализация и рендеринг (не влияет на логику)
    "Renderer",
    "renderer",
    "Camera",
    "Trail",
    "Obstacle",
    "Substrate",
    
    # UI и интерфейс (для отладки, но не для хищности)
    "UI",
    "ui.ts",
    "HUD",
    "Menu",
    
    # CSS и HTML (стилизация, не логика)
    ".css",
    ".html",
    
    # Утилиты и вспомогательное (не критично)
    "Util",
    "util",
    "Helper",
    "helper",
    
    # Скрипты и батники
    ".bat",
    ".sh",
    "collect_code",
    "merge_for_ai",
    
    # Временные файлы
    ".txt",
    ".md"
]

# ─────────────────────────────────────────────────────────────
# Вспомогательные файлы, которые МОЖНО включить если нужны
# ─────────────────────────────────────────────────────────────
OPTIONAL_FILES = [
    "src/simulation/Vector2D.ts",             # математика, может быть нужна
    "src/simulation/SpatialGrid.ts",          # поиск соседей (для оптимизации)
    "src/simulation/Genotype.ts",             # структура генов
]

def should_exclude(filepath):
    """Проверяет, должен ли файл быть исключен"""
    for pattern in EXCLUDE_PATTERNS:
        if pattern.lower() in filepath.lower():
            return True
    return False

def collect_code():
    """Собирает только критичные файлы"""
    print("=" * 70)
    print("СБОРЩИК КОДА GENE POOL — РЕЖИМ ХИЩНОСТИ")
    print("=" * 70)
    
    collected = []
    not_found = []
    
    # Проверяем критичные файлы
    print("\n[КРИТИЧНЫЕ ФАЙЛЫ]")
    for filepath in CRITICAL_FILES:
        if os.path.exists(filepath):
            print(f"  ✓ {filepath}")
            collected.append(filepath)
        else:
            print(f"  ✗ {filepath} — НЕ НАЙДЕН")
            not_found.append(filepath)
    
    # Проверяем опциональные файлы
    print("\n[ОПЦИОНАЛЬНЫЕ ФАЙЛЫ]")
    for filepath in OPTIONAL_FILES:
        if filepath not in CRITICAL_FILES and os.path.exists(filepath):
            print(f"  + {filepath}")
            collected.append(filepath)
    
    if not_found:
        print(f"\n⚠️  ВНИМАНИЕ: {len(not_found)} файл(ов) не найдено")
        print("Проверь что скрипт запущен из корня проекта")
    
    return collected

def write_file_with_numbers(filepath, out_file):
    """Записывает файл с нумерацией строк"""
    out_file.write(f"\n{'═' * 75}\n")
    out_file.write(f"FILE: {filepath}\n")
    out_file.write(f"{'═' * 75}\n\n")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as src:
            lines = src.readlines()
            
            # Ширина номера для выравнивания
            line_width = len(str(len(lines))) + 1
            
            for i, line in enumerate(lines, 1):
                # Убираем BOM в начале файла
                if i == 1 and line.startswith('\ufeff'):
                    line = line[1:]
                
                # Форматируем с номером строки
                out_file.write(f"{i:>{line_width}} │ {line}")
            
            out_file.write("\n")
            
    except UnicodeDecodeError:
        out_file.write(f"ОШИБКА КОДИРОВКИ (возможно бинарный файл)\n\n")
    except Exception as e:
        out_file.write(f"ОШИБКА ЧТЕНИЯ: {e}\n\n")

def main():
    # Собираем файлы
    collected_files = collect_code()
    
    if not collected_files:
        print("\n❌ Нет файлов для сборки!")
        return
    
    # Создаём выходной файл
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f"genePool_predation_code_{timestamp}.txt"
    
    print(f"\n[СБОРКА]")
    print(f"Собирается {len(collected_files)} файл(ов)...")
    print(f"Выходной файл: {output_file}\n")
    
    # Пишем файл
    with open(output_file, 'w', encoding='utf-8') as out:
        # Заголовок
        out.write("╔" + "═" * 73 + "╗\n")
        out.write("║" + " GENE POOL SWIMBOTS — ИСХОДНЫЙ КОД ХИЩНОСТИ ".center(73) + "║\n")
        out.write("║" + f" Сгенерировано: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".ljust(73) + "║\n")
        out.write("╚" + "═" * 73 + "╝\n")
        
        # Оглавление
        out.write("\n" + "─" * 75 + "\n")
        out.write("СОДЕРЖАНИЕ (только файлы для хищности):\n")
        out.write("─" * 75 + "\n\n")
        
        for i, f in enumerate(collected_files, 1):
            out.write(f"  {i:2d}. {f}\n")
        
        out.write("\n" + "═" * 75 + "\n")
        out.write("ИСХОДНЫЙ КОД\n")
        out.write("═" * 75 + "\n")
        
        # Код каждого файла
        for filepath in collected_files:
            write_file_with_numbers(filepath, out)
    
    # Статистика
    file_size = os.path.getsize(output_file)
    size_kb = file_size / 1024
    
    print("─" * 70)
    print(f"✓ Готово!")
    print(f"  Файл: {output_file}")
    print(f"  Размер: {size_kb:.1f} KB ({file_size} байт)")
    print(f"  Файлов: {len(collected_files)}")
    print("\nФайл готов для загрузки в AI (экономит ~70% токенов)")
    print("─" * 70)

if __name__ == "__main__":
    main()
