from time import sleep
import excel_handlers


def main():
    """
    Основная функция для обработки Excel файлов:
    - Запрашивает пути к двум файлам Excel.
    - Инициализирует и использует объекты классов ExcelHandler_for_order_list и ExcelHandler_for_purchase_list
      для обработки заказов и блюд соответственно.
    - Выводит ошибку, если путь к файлу Excel не найден.
    """

    print("\nВведіть к-ть замовлень клієнтів")
    quantity = input()
    order_file_path_list = []
    try:
        for i in range(int(quantity)):
            print(f"\nВведіть шлях до {i+1} файлу Excel")
            order_file_path_list.append(input())
    except:
        print('Это не целое число')

    print("\nВведіть 'а' для створення адмін файлу, або 'з' для файлу закупки:")
    admin_or_order_needed = input()
    dish_file_path = None
    if admin_or_order_needed == 'з':
        print("\nВведіть шлях к файлу Excel c расчетами")
        dish_file_path = input()

    if admin_or_order_needed not in ['з', 'а']:
        print("\nВи ввели щось не так")
        sleep(5)
        exit(0)

    try:
        if admin_or_order_needed == 'а':

            for path in order_file_path_list:
                order_handler = excel_handlers.ExcelHandler_for_order_list(
                    path)
                order_handler.handler_for_sheet_1()
                order_handler.handler_for_sheet_2()
                order_handler.handler_for_sheet_3()
                order_handler.saver()

        if dish_file_path:
            dish_handler = excel_handlers.ExcelHandler_for_purchase_list(
                order_file_path_list, dish_file_path)
            for path in order_file_path_list:
                path_to_wb = dish_handler.find_excel_path(path)
                dish_handler.add_menu_from_order_file(path_to_wb)
                dish_list = dish_handler.create_dish_list_sheet1(path_to_wb)
                tech_cards = dish_handler.dish_finder_calc(dish_list)
                dish_handler.create_tech_card_sheet(
                    tech_cards, dish_list, path_to_wb)
            dish_handler.saver()

        sleep(3)

    except ValueError as e:
        print(e)


if __name__ == "__main__":
    main()
