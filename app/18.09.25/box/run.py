from time import sleep
import excel_handlers


def main():
    """
    Main function for processing Excel files:
    - Prompts for paths to two Excel files.
    - Initializes and uses objects of the ExcelHandlerForBox and ExcelHandlerForBoxMenu classes
      to process orders and dishes respectively.
    - Displays an error if the Excel file path is not found.
    """

    print("\nВведіть к-ть замовлень клієнтів")
    quantity = input()
    order_file_path_list = []
    try:
        for i in range(int(quantity)):
            print(f"\nВведіть шлях до {i+1} файлу Excel")
            order_file_path_list.append(input())
    except ValueError:
        print('Это не целое число')
        sleep(5)
        exit(0)

    print("\nВведіть шлях к файлу Excel закупки")
    dish_file_path = input()

    try:
        if dish_file_path and order_file_path_list:
            dish_handler = excel_handlers.ExcelHandlerForBox(dish_file_path)
            for path in order_file_path_list:
                order_handler = excel_handlers.ExcelHandlerForBoxMenu(path)
                order_handler.handle_sheet_1()
                customer_name, dish_dict = dish_handler.create_dish_list_wb1_sheet1(
                    path)
                tech_cards = dish_handler.dish_finder_calc(dish_dict)
                dish_handler.create_tech_card_sheet(
                    tech_cards, customer_name, dish_dict)
                dish_handler.add_menus_to_purchase_file(
                    customer_name, order_handler.workbook_menu)
            dish_handler.save()
        else:
            print('Нічого не введено')

        sleep(3)

    except ValueError as e:
        print(f"Виникла помилка: {e}")
        sleep(5)
        exit(0)


if __name__ == "__main__":
    main()
