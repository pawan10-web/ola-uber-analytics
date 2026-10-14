CREATE DATABASE ola;
USE ola;

CREATE TABLE bookings (
    Event_Date DATE,  
    Event_Time TIME,  
    Booking_ID VARCHAR(20) PRIMARY KEY,  
    Booking_Status VARCHAR(20),  
    Customer_ID VARCHAR(20),  
    Vehicle_Type VARCHAR(50),  
    Pickup_Location VARCHAR(255),  
    Drop_Location VARCHAR(255),  
    V_TAT INT,  
    C_TAT INT,  
    Canceled_Rides_by_Customer VARCHAR(100),  
    Canceled_Rides_by_Driver VARCHAR(100),  
    Incomplete_Rides VARCHAR(10),  
    Incomplete_Rides_Reason TEXT,  
    Booking_Value int,  
    Payment_Method ENUM('Cash', 'Credit Card', 'UPI', 'Debit Card'),  
    Ride_Distance int,  
    Driver_Ratings DECIMAL(3,2),  
    Customer_Rating DECIMAL(3,2)  
);


SET GLOBAL LOCAL_INFILE=ON;
SHOW VARIABLES LIKE 'local_infile';

LOAD DATA LOCAL INFILE 'C:/Users/Anita Kalsekar/Downloads/Bookings.csv' INTO TABLE bookings
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\r\n'
IGNORE 1 LINES;

#--------------------------------------------------------------------------------------------------------------------------

#1. Retrive all successfull bookings
create view Successful_Bookings as #this will store all the info of successful bookings inside Successful_Bookings
select * from bookings where Booking_Status = 'Success';

#1. Answer in short
select * from Successful_Bookings; #after saving everything inside Successful_Bookings we can just run it like this


#--------------------------------------------------------------------------------------------------------------------------


#2. Find the avg ride distance for each vehicle type
create view Avg_ride_distance_for_each_vehicle_type as 
select Vehicle_type, avg(Ride_Distance) as avg_distance from bookings
group by Vehicle_type;

#2. Answer in short
select * from Avg_ride_distance_for_each_vehicle_type;


#--------------------------------------------------------------------------------------------------------------------------


#3. Get total number of cancelled rides by the customers
create view cancelled_rides_by_the_customers as
select count(*) from bookings where Booking_Status = 'Canceled by Customer';

#3. Answer in short
select * from cancelled_rides_by_the_customers;

#--------------------------------------------------------------------------------------------------------------------------



#4. List top 5 customers who booked the highest number of rides
create view top_5_customers_who_booked_the_highest_number_of_rides as
select  Customer_ID, count(Booking_ID) as total_rides from bookings
group by Customer_ID
order by total_rides desc limit 5;

#4. Answer in short
select * from top_5_customers_who_booked_the_highest_number_of_rides;


#--------------------------------------------------------------------------------------------------------------------------


#5. Get the numbers of rides cancelled by drivers due to personal and car related issues
create view rides_cancelled_by_drivers_personal_car_related_issues as 
select count(*) from bookings where Canceled_Rides_by_Driver='Personal & Car related issue';

#5. Answer in short
select * from rides_cancelled_by_drivers_personal_car_related_issues;

#--------------------------------------------------------------------------------------------------------------------------



#6. Find max and min driver ratings for Prime Sedan bookings
create view max_and_min_driver_ratings_for_Prime_Sedan as
select max(Driver_Ratings) as max_driver_rating, min(Driver_Ratings) as min_driver_rating
from bookings where Vehicle_Type='Prime Sedan';

#6. Answer in short
select * from max_and_min_driver_ratings_for_Prime_Sedan;


#-----------------------------------------------------------------------------------------------------------------------



#7. Retrive all rides where payment was made using UPI
create view payment_made_using_UPI as
select * from bookings where Payment_Method='UPI';

#7. Answer in short
select * from payment_made_using_UPI;

#-----------------------------------------------------------------------------------------------------------------------



#8. Find avg customer rating per vehicle type
create view avg_customer_rating_per_vehicle_type as
select Vehicle_Type, avg(Customer_Rating) as avg_customer_rating
from bookings
group by Vehicle_Type;

#8. Answer in short
select * from avg_customer_rating_per_vehicle_type;



#-----------------------------------------------------------------------------------------------------------------------



#9. Calculate the total booking value of rides completed successfully
create view total_booking_value_of_rides_successful as
select sum(Booking_Value) as total_successful_ride_value
from bookings
where Booking_Status='Success';

#9. Answer in short
select * from total_booking_value_of_rides_successful;


#-----------------------------------------------------------------------------------------------------------------------



#10. List all incomplete rides along with the reason
create view incomplete_rides_along_with_reason as
select Customer_ID, Booking_ID, Incomplete_Rides, Incomplete_Rides_Reason
from bookings
where Incomplete_Rides='Yes';

#10. Answer in short
select * from incomplete_rides_along_with_reason;