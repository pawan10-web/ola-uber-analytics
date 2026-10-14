# 🚖 Ola Ride Data Analysis using SQL and Power Bi

## 📌 Project Overview  
This project analyzes **Ola ride data** to uncover key insights about booking trends, ride cancellations, payment methods, and customer behavior. Using **SQL (MySQL Workbench)**, we performed data cleaning, aggregation, and trend analysis to provide business insights.  

## 🛠️ Technologies Used  
- **SQL (MySQL Workbench)** – Data extraction, and transformation  
- **Excel** – Data preprocessing and cleaning 
- **Power BI** – Visualization of ride trends and key metrics  

---

## 📊 Key Insights & Analysis  
✅ Identified **successful bookings and revenue trends**  
✅ Analyzed **canceled rides by customers and drivers**  
✅ Found **top 5 customers with the highest bookings**  
✅ Computed **average ride distance per vehicle type**  
✅ Extracted **payment trends and incomplete ride reasons**  

---

## 📂 Project Structure  

```
Ola-Ride-Data-Analysis/
│-- SQL/
│   ├── ola_schema.sql                 # Database and table creation
│   ├── data_cleaning.sql               # Data cleaning queries
│   ├── ride_trends.sql                 # Ride trend analysis queries
│   ├── revenue_analysis.sql            # Revenue and payment insights
│-- Excel/
│   ├── cleaned_data.xlsx               # Processed dataset for analysis
│-- PowerBI/ (Optional)
│   ├── ola_dashboard.pbix               # Power BI interactive dashboard
│-- README.md                            # Project documentation
```

---

## 🔍 SQL Queries Breakdown  
### **1️⃣ Successful Bookings**  
```sql
CREATE VIEW Successful_Bookings AS 
SELECT * FROM bookings WHERE Booking_Status = 'Success';
```

### **2️⃣ Average Ride Distance Per Vehicle Type**  
```sql
CREATE VIEW Avg_Ride_Distance AS 
SELECT Vehicle_Type, AVG(Ride_Distance) AS avg_distance 
FROM bookings GROUP BY Vehicle_Type;
```

### **3️⃣ Top 5 Customers with Most Bookings**  
```sql
CREATE VIEW Top_5_Customers AS 
SELECT Customer_ID, COUNT(Booking_ID) AS total_rides 
FROM bookings 
GROUP BY Customer_ID 
ORDER BY total_rides DESC LIMIT 5;
```

### **4️⃣ Total Booking Value of Successful Rides**  
```sql
CREATE VIEW Total_Successful_Ride_Value AS 
SELECT SUM(Booking_Value) AS total_revenue 
FROM bookings WHERE Booking_Status = 'Success';
```

*(More SQL queries can be found in the `/SQL` folder.)*  

---

## 📊 Power BI Dashboard
The **Power BI dashboard** visualizes:  
📌 **Total revenue trends** 📈  
📌 **Peak ride hours** 🕒  
📌 **Customer booking patterns** 🗺️  

![Screenshot 2025-02-20 114246](https://github.com/user-attachments/assets/570d36eb-4b3b-464c-8fe9-f6e335f0749a)

![Screenshot 2025-02-20 114259](https://github.com/user-attachments/assets/b1c09e39-dae0-4eec-8afe-f8d8fcd18ecf)

![Screenshot 2025-02-20 114311](https://github.com/user-attachments/assets/85fa6137-0a9e-4a80-b2a5-b0d777288830)

![Screenshot 2025-02-20 114321](https://github.com/user-attachments/assets/2c3634fd-31a7-430e-b3e6-eff6d4393251)

![Screenshot 2025-02-20 114341](https://github.com/user-attachments/assets/9b9fc6bb-b8d6-4a08-b875-33a817b6efdb)



---

## 🚀 How to Use  
1️⃣ Clone the repository:  
```bash
git clone https://github.com/yourusername/Ola-Ride-Data-Analysis.git
```
2️⃣ Open **SQL files** in MySQL Workbench and run queries.  
3️⃣ Use **cleaned_data.xlsx** for Excel-based analysis.  
4️⃣ Open **ola_dashboard.pbix** in Power BI (if applicable).  


---

⭐ **If you found this project helpful, don’t forget to give it a star!** ⭐  
